import fs from "node:fs";
import path from "node:path";

const DEFAULT_INCLUDE = "**/*.md";
const DEFAULT_EXCLUDE = "**/node_modules/**,**/dist/**,**/build/**";

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

function slugifyHeading(text, seen) {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!base) {
    return null;
  }

  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  if (count === 0) {
    return base;
  }
  return `${base}-${count}`;
}

function getAnchorMap(filePath, cache) {
  if (cache.has(filePath)) {
    return cache.get(filePath);
  }
  const anchors = new Set();
  const seen = new Map();
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) {
      continue;
    }
    const heading = match[2].trim();
    const slug = slugifyHeading(heading, seen);
    if (slug) {
      anchors.add(slug);
    }
  }
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

function isExternalLink(target) {
  return /^(https?:|mailto:|tel:|data:|ftp:)/i.test(target);
}

function extractLinks(content) {
  const links = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(line))) {
      const start = match.index;
      if (start > 0 && line[start - 1] === "!") {
        continue;
      }
      links.push({
        line: index + 1,
        raw: match[2],
      });
    }
  }
  return links;
}

function checkFileLinks(filePath, root, anchorCache) {
  const issues = [];
  const content = fs.readFileSync(filePath, "utf8");
  const links = extractLinks(content);
  const fileDir = path.dirname(filePath);

  for (const link of links) {
    const target = parseLinkTarget(link.raw);
    if (!target || isExternalLink(target)) {
      continue;
    }

    const [pathPart, anchorPart] = target.split("#");
    const hasPath = pathPart && pathPart.length > 0;
    const resolvedPath = hasPath
      ? path.resolve(fileDir, pathPart)
      : filePath;

    if (hasPath && !fs.existsSync(resolvedPath)) {
      issues.push({
        file: filePath,
        line: link.line,
        target,
        reason: "missing file",
      });
      continue;
    }

    if (anchorPart) {
      const anchors = getAnchorMap(resolvedPath, anchorCache);
      if (!anchors.has(anchorPart)) {
        issues.push({
          file: filePath,
          line: link.line,
          target,
          reason: "missing anchor",
        });
      }
    }
  }

  return issues;
}

function checkMarkdownLinks(options = {}) {
  const root = options.root ? path.resolve(options.root) : process.cwd();
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;

  const files = listMarkdownFiles(root, include, exclude);
  const anchorCache = new Map();
  const issues = [];

  for (const file of files) {
    issues.push(...checkFileLinks(file, root, anchorCache));
  }

  return { root, files, issues };
}

export { checkMarkdownLinks };
