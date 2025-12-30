#!/bin/bash
# Check if aiwrapper is linked to local version

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SILA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -L node_modules/aiwrapper ]; then
  TARGET=$(readlink -f node_modules/aiwrapper)
  if [[ "$TARGET" == *"/aiwrapper" ]] && [ -d "$TARGET" ]; then
    echo "✓ Linked to local aiwrapper: $TARGET"
    exit 0
  else
    echo "⚠ Symlink exists but points to unexpected location: $TARGET"
    exit 1
  fi
else
  echo "Using published aiwrapper package (not linked)"
  exit 0
fi
