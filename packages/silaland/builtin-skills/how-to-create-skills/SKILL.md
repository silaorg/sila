---
name: how-to-create-skills
description: Use this when a user says a task keeps coming up and wants to turn it into a repeatable workflow.
---

What this skill is for
- Helping create a new skill when work repeats and should be handled the same way each time.

How skills work (high level)
- A skill is a small instruction package that teaches the agent how to handle one kind of task.
- Skills show when to activate, what steps to follow, and what files or tools to use.
- Skills are discovered from the `name` and `description` in SKILL.md frontmatter.

Where to write skills
- Land-specific skills: `<land root>/skills/<skill-name>/SKILL.md`
- Built-in skills in the silaland package: `<silaland package>/builtin-skills/<skill-name>/SKILL.md`

Basic shape of a skill file
- Start with YAML frontmatter including `name` and `description`.
- Keep the body short and practical: when to use it, steps to follow, and expected output.
- Use lowercase-hyphen names and make folder name match `name`.
