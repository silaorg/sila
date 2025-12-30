#!/bin/bash
# Unlink from local aiwrapper and use published version

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SILA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Unlinking local aiwrapper..."

cd "$SILA_DIR"
npm unlink aiwrapper 2>/dev/null || true
# Remove symlink if it still exists (workspace handling)
[ -L node_modules/aiwrapper ] && rm -f node_modules/aiwrapper
[ -L packages/core/node_modules/aiwrapper ] && rm -f packages/core/node_modules/aiwrapper
npm install -w packages/core

echo "✓ Now using published aiwrapper package"
