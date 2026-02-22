import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { appendSkillCatalogInstructions, loadSkillIndex } from "../src/skills.js";

test("loadSkillIndex returns valid skills and skips invalid ones", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "silaland-skills-"));
  const landDir = path.join(tempRoot, "land");
  const skillsDir = path.join(landDir, "skills");

  await fs.mkdir(path.join(skillsDir, "code-review"), { recursive: true });
  await fs.writeFile(
    path.join(skillsDir, "code-review", "SKILL.md"),
    [
      "---",
      "name: code-review",
      "description: Reviews code changes for bugs and regressions when users ask for review help.",
      "---",
      "",
      "# Code Review",
      "Use this skill for reviewing code.",
      "",
    ].join("\n"),
    "utf8",
  );

  await fs.mkdir(path.join(skillsDir, "bad-name"), { recursive: true });
  await fs.writeFile(
    path.join(skillsDir, "bad-name", "SKILL.md"),
    [
      "---",
      "name: bad--name",
      "description: Invalid because of consecutive hyphens in the name.",
      "---",
      "",
    ].join("\n"),
    "utf8",
  );

  await fs.mkdir(path.join(skillsDir, "wrong-dir"), { recursive: true });
  await fs.writeFile(
    path.join(skillsDir, "wrong-dir", "SKILL.md"),
    [
      "---",
      "name: different-name",
      "description: Invalid because name does not match directory.",
      "---",
      "",
    ].join("\n"),
    "utf8",
  );

  const skills = await loadSkillIndex(landDir);

  assert.equal(skills.length, 1);
  assert.deepEqual(skills[0], {
    name: "code-review",
    description: "Reviews code changes for bugs and regressions when users ask for review help.",
    relativeSkillFilePath: "skills/code-review/SKILL.md",
  });
});

test("appendSkillCatalogInstructions keeps base instructions when no skills exist", () => {
  const baseInstructions = "You are a concise assistant.";
  const result = appendSkillCatalogInstructions(baseInstructions, []);
  assert.equal(result, baseInstructions);
});

test("appendSkillCatalogInstructions appends a skills catalog block", () => {
  const result = appendSkillCatalogInstructions("Base", [
    {
      name: "pdf-processing",
      description: "Handles PDF extraction and form filling tasks.",
      relativeSkillFilePath: "skills/pdf-processing/SKILL.md",
    },
  ]);

  assert.match(result, /Available skills:/);
  assert.match(result, /pdf-processing: Handles PDF extraction and form filling tasks\./);
  assert.match(result, /skills\/pdf-processing\/SKILL\.md/);
});
