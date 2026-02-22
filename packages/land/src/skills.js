import fs from "node:fs/promises";
import path from "node:path";

const SKILLS_DIR_NAME = "skills";
const SKILL_FILE_NAME = "SKILL.md";
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @param {string} landPath
 * @returns {Promise<Array<{name: string; description: string; relativeSkillFilePath: string}>>}
 */
export async function loadSkillIndex(landPath) {
  const skillsDirPath = path.join(landPath, SKILLS_DIR_NAME);
  const entries = await readDirectoryEntriesOrEmpty(skillsDirPath);
  const sortedEntries = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  /** @type {Array<{name: string; description: string; relativeSkillFilePath: string}>} */
  const skills = [];
  for (const entry of sortedEntries) {
    const skillDirPath = path.join(skillsDirPath, entry.name);
    const skillFilePath = path.join(skillDirPath, SKILL_FILE_NAME);
    const raw = await readFileOrNull(skillFilePath);

    if (raw === null) {
      continue;
    }

    try {
      const parsed = parseAndValidateSkillFile(raw, entry.name);
      skills.push({
        name: parsed.name,
        description: parsed.description,
        relativeSkillFilePath: path.posix.join(SKILLS_DIR_NAME, entry.name, SKILL_FILE_NAME),
      });
    } catch (error) {
      console.warn(`Skipping invalid skill at ${skillFilePath}: ${error.message}`);
    }
  }

  return skills;
}

/**
 * @param {string} baseInstructions
 * @param {Array<{name: string; description: string; relativeSkillFilePath: string}>} skills
 */
export function appendSkillCatalogInstructions(baseInstructions, skills) {
  if (!skills.length) {
    return baseInstructions;
  }

  const lines = [
    baseInstructions,
    "",
    "Agent Skills are available under the land's skills directory.",
    "Use each skill name and description below to decide relevance.",
    "When a skill is relevant, read its SKILL.md with read_document exactly once before acting.",
    "After activation, read referenced files only as needed.",
    "Skip unrelated skills.",
    "Available skills:",
  ];

  for (const skill of skills) {
    lines.push(`- ${skill.name}: ${skill.description} (file: ${skill.relativeSkillFilePath})`);
  }

  return lines.join("\n");
}

function parseAndValidateSkillFile(rawSkillContent, directoryName) {
  const frontmatter = readFrontmatter(rawSkillContent);
  if (!frontmatter) {
    throw new Error("missing YAML frontmatter");
  }

  const name = String(frontmatter.get("name") ?? "").trim();
  const description = String(frontmatter.get("description") ?? "").trim();

  validateSkillName(name, directoryName);
  validateSkillDescription(description);

  return {
    name,
    description,
  };
}

function readFrontmatter(content) {
  const normalized = content.startsWith("\uFEFF") ? content.slice(1) : content;
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return null;
  }

  const lines = match[1].split(/\r?\n/);
  /** @type {Map<string, string>} */
  const result = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    if (/^\s/.test(line)) {
      continue;
    }

    const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!fieldMatch) {
      continue;
    }

    const [, key, rawValue] = fieldMatch;
    result.set(key, parseYamlScalar(rawValue));
  }

  return result;
}

function parseYamlScalar(rawValue) {
  const value = rawValue.trim();
  if (value.length < 2) {
    return value;
  }

  const quote = value[0];
  if ((quote !== "\"" && quote !== "'") || value[value.length - 1] !== quote) {
    return value;
  }

  const unwrapped = value.slice(1, -1);
  if (quote === "\"") {
    return unwrapped.replace(/\\"/g, "\"").replace(/\\n/g, "\n");
  }
  return unwrapped.replace(/\\'/g, "'");
}

function validateSkillName(name, directoryName) {
  if (!name.length || name.length > 64) {
    throw new Error("name must be between 1 and 64 characters");
  }
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new Error(
      "name must use lowercase letters, numbers, and single hyphens without leading/trailing hyphens",
    );
  }
  if (name !== directoryName) {
    throw new Error(`name "${name}" must match the skill directory "${directoryName}"`);
  }
}

function validateSkillDescription(description) {
  if (!description.length || description.length > 1024) {
    throw new Error("description must be between 1 and 1024 characters");
  }
}

async function readDirectoryEntriesOrEmpty(directoryPath) {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readFileOrNull(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
