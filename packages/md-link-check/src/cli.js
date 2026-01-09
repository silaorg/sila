#!/usr/bin/env node

import path from "node:path";
import { checkMarkdownLinks } from "./index.js";

/**
 * @typedef {object} CliArgs
 * @property {string=} include
 * @property {string=} exclude
 * @property {string=} root
 * @property {boolean} checkExternal
 * @property {boolean=} help
 */

function printHelp() {
  console.log("md-link-check [root] --include \"docs/**/*.md\" --exclude \"**/node_modules/**\"");
  console.log("");
  console.log("Options:");
  console.log("  --include       Comma-separated glob patterns (default: **/*.md)");
  console.log("  --exclude       Comma-separated glob patterns");
  console.log("  --no-external   Skip external link checks");
  console.log("  --help          Show this help message");
}

/**
 * @param {string[]} argv
 * @returns {CliArgs}
 */
function parseArgs(argv) {
  /** @type {CliArgs} */
  const args = { include: undefined, exclude: undefined, root: undefined, checkExternal: true };
  const positionals = [];

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--no-external") {
      args.checkExternal = false;
      continue;
    }
    if (arg === "--include") {
      args.include = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--exclude") {
      args.exclude = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--include=")) {
      args.include = arg.split("=")[1];
      continue;
    }
    if (arg.startsWith("--exclude=")) {
      args.exclude = arg.split("=")[1];
      continue;
    }
    positionals.push(arg);
  }

  if (positionals.length > 0) {
    args.root = positionals[0];
  }

  return args;
}

/**
 * @param {{file: string, target: string, reason: string}} issue
 * @param {string} root
 */
function formatIssue(issue, root) {
  const relative = path.relative(root, issue.file).split(path.sep).join("/");
  return `${relative} broken link -> ${issue.target} (${issue.reason})`;
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const result = await checkMarkdownLinks({
    root: args.root,
    include: args.include,
    exclude: args.exclude,
    checkExternal: args.checkExternal,
  });

  if (result.issues.length === 0) {
    console.log(`Checked ${result.files.length} files. No broken links found.`);
    process.exit(0);
  }

  for (const issue of result.issues) {
    console.log(formatIssue(issue, result.root));
  }
  console.log(`\n${result.issues.length} broken link(s) found.`);
  process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
