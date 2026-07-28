---
name: how-to-create-tools
description: Use this when a user wants to add a repeatable executable capability to a land or asks whether something should be a skill or a tool.
---

What this skill is for
- Helping decide whether a new land extension should be a skill or a tool.
- Helping create a new land tool when the agent needs a direct executable action.

How to decide between a skill and a tool
- Start with a skill when the work can be done by teaching the agent a workflow, playbook, or how to use existing CLI programs and scripts.
- Create a tool when the agent needs a new direct action that should be easy and reliable to call again.
- Prefer a small number of clear tools. Too many tools can make tool choice noisy and less reliable.

Where to write tools
- Land tools: `<land root>/tools/<tool-name>/package.json`
- Tool entry file: `main` from `package.json`, or `index.js` if `main` is missing

Recommended land setup
- Prefer a land root `package.json` with `workspaces: ["tools/*"]` so tools can share packages.
- Keep each tool as its own small package under `tools/`.

Basic shape of a tool package
- Add a `package.json` with `type: "module"` and `main: "./index.js"`.
- Export either `createTool(context)`, a default factory, or a default tool object.
- Return a tool object with `name`, `description`, `parameters`, and `handler`.

Tool design guidelines
- Keep one tool focused on one job.
- Choose a clear action-oriented name.
- Keep parameters small and explicit.
- Return structured results that are easy for the agent to use.
- Prefer a skill instead of a new tool when the capability already exists through normal commands or scripts.
