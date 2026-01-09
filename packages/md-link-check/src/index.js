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

function splitPatterns(value, fallback) {
  const raw = value && value.trim().length > 0 ? value : fallback;
  return raw.split(",").map((pattern) => pattern.trim()).filter(Boolean);
}

function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchPatterns(filePath, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(filePath));
}

function listMarkdownFiles(root, include, exclude) {
  const files = [];
  const includePatterns = splitPatterns(include, DEFAULT_INCLUDE);
  const excludePatterns = splitPatterns(exclude, DEFAULT_EXCLUDE);

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

function removeCodeBlocks(markdown) {
  return markdown.replace(/^```[\S\s]+?^```$/gm, "");
}

function extractHtmlSections(markdown) {
  markdown = removeCodeBlocks(markdown)
    .replace(/<!--[\S\s]+?-->/gm, "")
    .replace(/(?<!\\)`[\S\s]+?(?<!\\)`/gm, "");

  const regexAllId = /<(?<tag>[^\s]+).*?id=["'](?<id>[^"']*?)["'].*?>/gim;
  const regexAName = /<a.*?name=["'](?<name>[^"']*?)["'].*?>/gim;

  const sections = []
    .concat(Array.from(markdown.matchAll(regexAllId), (match) => match.groups.id))
    .concat(Array.from(markdown.matchAll(regexAName), (match) => match.groups.name));

  return sections;
}

function extractSections(markdown) {
  markdown = removeCodeBlocks(markdown);
  const sectionTitles = markdown.match(/^#+ .*$/gm) || [];

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

function getAnchorSet(filePath, cache) {
  if (cache.has(filePath)) {
    return cache.get(filePath);
  }
  const markdown = fs.readFileSync(filePath, "utf8");
  const anchors = new Set(extractSections(markdown).concat(extractHtmlSections(markdown)));
  cache.set(filePath, anchors);
  return anchors;
}

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

function resolveFileTarget(baseUrl, targetPath) {
  const resolved = new URL(targetPath, baseUrl);
  if (resolved.protocol !== "file:") {
    return null;
  }
  return fileURLToPath(resolved);
}

function isExternalLink(target, externalPattern) {
  return externalPattern.test(target);
}

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

  const issues = [];

  for (const result of results) {
    const target = parseLinkTarget(result.link);
    if (!target || isExternalLink(target, externalPattern)) {
      continue;
    }

    const [pathPart, anchorPart] = target.split("#");
    const hasPath = pathPart && pathPart.length > 0;

    if (!hasPath && anchorPart) {
      if (result.status !== 200) {
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

    if (result.status !== 200) {
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

  const issues = [];

  for (const result of results) {
    const target = parseLinkTarget(result.link);
    if (!target || !isExternalLink(target, externalPattern)) {
      continue;
    }

    if (result.status !== 200) {
      issues.push({
        file,
        target,
        reason: result.status === "error" ? "external error" : "external dead",
      });
    }
  }

  return issues;
}

async function checkMarkdownLinks(options = {}) {
  const root = options.root ? path.resolve(options.root) : process.cwd();
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;
  const externalPattern = options.externalPattern ?? DEFAULT_EXTERNAL_IGNORE;
  const checkExternal = options.checkExternal ?? true;

  const files = listMarkdownFiles(root, include, exclude);
  const anchorCache = new Map();
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
