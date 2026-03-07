# Agents

Agents in Sila can be extended with skills and tools.

Skills and tools are similar. Both help an agent do better work for a specific land, team, or workflow.

A skill is mainly guidance. It teaches the agent how to approach a kind of task. Skills are good for playbooks, checklists, repeatable workflows, domain knowledge, and instructions that explain which files, commands, or programs to use.

Skills can also unlock capability in practice, because a skill may tell the agent to use existing CLI programs, scripts, or other resources that are already available in the land.

A tool is mainly a direct capability. It gives the agent a new action it can run in a straightforward way. Tools are good for calling APIs, querying internal systems, generating files in a standard format, or doing something the base agent could not do on its own.

In practice, agents can decide whether something should become a skill or a tool.

As a simple rule:

- if the agent mostly needs to know how to do the work, make a skill
- if the agent needs a new direct action that should be simple to call again and again, make a tool

Often the right path is to start with a skill and only add a tool when a dedicated action would make the workflow cleaner.

Tools should stay focused. Too many tools can overwhelm an agent, so it is usually better to have a small set of clear tools and use skills for the rest.

Skills and tools can be built in, or added just for one land.
