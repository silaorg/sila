import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";
import markdownLinkCheck from "markdown-link-check";

const DEFAULT_INCLUDE = "**/*.md";
const DEFAULT_EXCLUDE = "**/node_modules/**,**/dist/**,**/build/**";
const DEFAULT_EXTERNAL_IGNORE = /^(https?:|mailto:|tel:|data:|ftp:)/i;
const INTERNAL_LINK = /^(#|\.?\/?|\.\.\/)/;

const markdownLinkCheckAsync = promisify(markdownLinkCheck);

/**
 * @typedef {object} Issue
 * @property {string} file
 * @property {string} target
 * @property {"missing anchor" | "missing file" | "unsupported protocol" | "external error" | "external dead"} reason
 */

/**
 * @typedef {object} CheckMarkdownLinksOptions
 * @property {string=} root
 * @property {string=} include
 * @property {string=} exclude
 * @property {RegExp=} externalPattern
 * @property {boolean=} checkExternal
 */

/**
 * @typedef {object} InternalCheckOptions
 * @property {Map<string, Set<string>>} anchorCache
 * @property {RegExp} externalPattern
 */

/**
 * @typedef {object} ExternalCheckOptions
 * @property {RegExp} externalPattern
 */

/**
 * @param {{status?: string, statusCode?: number}} result
 */
function isAlive(result) {
  // markdown-link-check returns:
  // - status: "alive" | "dead" | "ignored"
  // - statusCode: number (0 when not available)
  return result.status === "alive" || result.status === "ignored" || result.statusCode === 200;
}

/**
 * @param {string | undefined} value
 * @param {string} fallback
 */
function splitPatterns(value, fallback) {
  const raw = value && value.trim().length > 0 ? value : fallback;
  return raw.split(",").map((pattern) => pattern.trim()).filter(Boolean);
}

/**
 * @param {string} pattern
 */
function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * @param {string} filePath
 * @param {string[]} patterns
 */
function matchPatterns(filePath, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(filePath));
}

/**
 * @param {string} root
 * @param {string | undefined} include
 * @param {string | undefined} exclude
 */
function listMarkdownFiles(root, include, exclude) {
  /** @type {string[]} */
  const files = [];
  const includePatterns = splitPatterns(include, DEFAULT_INCLUDE);
  const excludePatterns = splitPatterns(exclude, DEFAULT_EXCLUDE);

  /**
   * @param {string} current
   */
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      const relative = path.relative(root, entryPath).split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (matchPatterns(relative, excludePatterns)) {
          continue;
        }
        walk(entryPath);
        continue;
      }
      if (!matchPatterns(relative, includePatterns)) {
        continue;
      }
      if (matchPatterns(relative, excludePatterns)) {
        continue;
      }
      files.push(entryPath);
    }
  }

  walk(root);
  return files;
}

/**
 * @param {string} markdown
 */
function removeCodeBlocks(markdown) {
  return markdown.replace(/^```[\S\s]+?^```$/gm, "");
}

/**
 * @param {string} markdown
 */
function extractHtmlSections(markdown) {
  markdown = removeCodeBlocks(markdown)
    .replace(/<!--[\S\s]+?-->/gm, "")
    .replace(/(?<!\\)`[\S\s]+?(?<!\\)`/gm, "");

  const regexAllId = /<(?<tag>[^\s]+).*?id=["'](?<id>[^"']*?)["'].*?>/gim;
  const regexAName = /<a.*?name=["'](?<name>[^"']*?)["'].*?>/gim;

  /** @type {string[]} */
  const sections = [];

  for (const match of markdown.matchAll(regexAllId)) {
    const id = match.groups?.id;
    if (id) sections.push(id);
  }
  for (const match of markdown.matchAll(regexAName)) {
    const name = match.groups?.name;
    if (name) sections.push(name);
  }

  return sections;
}

/**
 * @param {string} markdown
 */
function extractSections(markdown) {
  markdown = removeCodeBlocks(markdown);
  const sectionTitles = markdown.match(/^#+ .*$/gm) || [];

  /** @type {string[]} */
  const sections = sectionTitles.map((section) =>
    encodeURIComponent(
      section
        .replace(/\[(.+)\]\(((?:\.?\/|https?:\/\/|#)[\w\d./?=#-]+)\)/, "$1")
        .toLowerCase()
        .replace(/^#+\s*/, "")
        .replace(/[^\p{L}\p{Nd}\p{Nl}\s_\-`]/gu, "")
        .replace(/\*(?=.*)/gu, "")
        .replace(/`/gu, "")
        .replace(/\s/gu, "-")
    )
  );

  /** @type {Record<string, number>} */
  const uniq = {};
  for (let section of sections) {
    if (section in uniq) {
      uniq[section] += 1;
      section = `${section}-${uniq[section]}`;
    }
    uniq[section] = 0;
  }

  return Object.keys(uniq) ?? [];
}

/**
 * @param {string} filePath
 * @param {Map<string, Set<string>>} cache
 */
function getAnchorSet(filePath, cache) {
  if (cache.has(filePath)) {
    const cached = cache.get(filePath);
    if (cached) return cached;
  }
  const markdown = fs.readFileSync(filePath, "utf8");
  const anchors = new Set(extractSections(markdown).concat(extractHtmlSections(markdown)));
  cache.set(filePath, anchors);
  return anchors;
}

/**
 * @param {string} raw
 */
function parseLinkTarget(raw) {
  let target = raw.trim();
  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1);
  }
  if (target.includes(" ")) {
    target = target.split(/\s+/)[0];
  }
  return target;
}

/**
 * @param {string} baseUrl
 * @param {string} targetPath
 */
function resolveFileTarget(baseUrl, targetPath) {
  const resolved = new URL(targetPath, baseUrl);
  if (resolved.protocol !== "file:") {
    return null;
  }
  return fileURLToPath(resolved);
}

/**
 * @param {string} target
 * @param {RegExp} externalPattern
 */
function isExternalLink(target, externalPattern) {
  return externalPattern.test(target);
}

/**
 * @param {string} file
 * @param {InternalCheckOptions} options
 * @returns {Promise<Issue[]>}
 */
async function checkInternalLinks(file, options) {
  const content = fs.readFileSync(file, "utf8");
  const fileDir = path.dirname(file);
  const baseUrl = pathToFileURL(`${fileDir}${path.sep}`).href;
  const anchorCache = options.anchorCache;
  const externalPattern = options.externalPattern;

  const results = await markdownLinkCheckAsync(content, {
    baseUrl,
    ignorePatterns: [{ pattern: externalPattern }],
    showProgressBar: false,
  });

  /** @type {Issue[]} */
  const issues = [];

  for (const result of results) {
    const target = parseLinkTarget(result.link);
    if (!target || isExternalLink(target, externalPattern)) {
      continue;
    }

    const [pathPart, anchorPart] = target.split("#");
    const hasPath = pathPart && pathPart.length > 0;

    if (!hasPath && anchorPart) {
      if (!isAlive(result)) {
        issues.push({
          file,
          target,
          reason: "missing anchor",
        });
      }
      continue;
    }

    const resolvedPath = resolveFileTarget(baseUrl, pathPart);
    if (!resolvedPath) {
      issues.push({
        file,
        target,
        reason: "unsupported protocol",
      });
      continue;
    }

    if (!isAlive(result)) {
      issues.push({
        file,
        target,
        reason: "missing file",
      });
      continue;
    }

    if (anchorPart) {
      const anchors = getAnchorSet(resolvedPath, anchorCache);
      if (!anchors.has(anchorPart)) {
        issues.push({
          file,
          target,
          reason: "missing anchor",
        });
      }
    }
  }

  return issues;
}

/**
 * @param {string} file
 * @param {ExternalCheckOptions} options
 * @returns {Promise<Issue[]>}
 */
async function checkExternalLinks(file, options) {
  const content = fs.readFileSync(file, "utf8");
  const fileDir = path.dirname(file);
  const baseUrl = pathToFileURL(`${fileDir}${path.sep}`).href;
  const externalPattern = options.externalPattern;

  const results = await markdownLinkCheckAsync(content, {
    baseUrl,
    ignorePatterns: [{ pattern: INTERNAL_LINK }],
    showProgressBar: false,
  });

  /** @type {Issue[]} */
  const issues = [];

  for (const result of results) {
    const target = parseLinkTarget(result.link);
    if (!target || !isExternalLink(target, externalPattern)) {
      continue;
    }

    if (!isAlive(result)) {
      issues.push({
        file,
        target,
        reason: result.status === "error" ? "external error" : "external dead",
      });
    }
  }

  return issues;
}

/**
 * @param {CheckMarkdownLinksOptions=} options
 */
async function checkMarkdownLinks(options = {}) {
  const root = options.root ? path.resolve(options.root) : process.cwd();
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;
  const externalPattern = options.externalPattern ?? DEFAULT_EXTERNAL_IGNORE;
  const checkExternal = options.checkExternal ?? true;

  const files = listMarkdownFiles(root, include, exclude);
  const anchorCache = new Map();
  /** @type {Issue[]} */
  const issues = [];

  for (const file of files) {
    const internalIssues = await checkInternalLinks(file, {
      anchorCache,
      externalPattern,
    });
    issues.push(...internalIssues);

    if (checkExternal) {
      const externalIssues = await checkExternalLinks(file, {
        externalPattern,
      });
      issues.push(...externalIssues);
    }
  }

  return { root, files, issues };
}

export { checkMarkdownLinks };
