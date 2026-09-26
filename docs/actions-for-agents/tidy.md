Tidy the relevant Heswe code without changing product behavior.

Look for dead or duplicated code, confusing names, unnecessary layers, brittle control flow, and stale documentation. Keep the workspace, channel, and agent runtime boundaries easy to explain.

Good tidy work includes:

- deleting unused helpers and stale compatibility paths
- simplifying names, control flow, and file structure
- consolidating duplicate channel or runtime behavior
- tightening directly related tests and docs
- keeping unrelated features and broad rewrites out of the change

Run the focused tests for the touched package, then the relevant workspace checks. End with a concise summary of what became simpler and anything that still needs a larger refactor.
