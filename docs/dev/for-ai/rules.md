# Basics for AI agents

## Icons
Use lucide-svelte icons, like this: 
import { Check } from "lucide-svelte";
and <Check size={14} />

# Git commits
Use imperative mood and use a prefix for the type of change.
Examples:
feat(auth): add user login
fix(payment): resolve gateway timeout
ci: update release workflow
docs: update README
deps: aiwrapper to 3.0.1
dev: add the core and the client as aliases to the sveltkit config

## Commit types
Any product-related feature - "feat(name): description"
Any product-related fix - "fix(name): description"
Anything related to building and releasing (including fixes of CI) - "ci: description"
Anything related to testing - "tests: description"
Anything related to documentation - "docs: description"
Any dependency updates - "deps: description"
Anything related to the build pipelines and dev convinience - "dev: description"