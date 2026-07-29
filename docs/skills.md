# Skills

Skills are reusable instruction packages that teach [agents](agents.md) how to
handle a kind of task. A skill can contain domain knowledge, a checklist, a
workflow, or guidance about files, scripts, and [tools](tools.md).

Use a skill when an agent already has the required capabilities but needs to
follow a specific process or apply knowledge consistently. For example, a
research skill can require citations and a saved report, while a code review
skill can apply one team’s checklist every time.

Skills follow the open [Agent Skills format](https://skill.md/). Workspace
skills live at `skills/<skill-name>/SKILL.md`. Heswe also provides built-in
skills. A workspace skill with the same name overrides the built-in one.
