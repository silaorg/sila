#!/bin/bash
# Link to local aiwrapper package for testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SILA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AIWRAPPER_PATH="$(cd "$SILA_DIR/../aiwrapper" && pwd)"

if [ ! -d "$AIWRAPPER_PATH" ]; then
  echo "Error: aiwrapper directory not found at $AIWRAPPER_PATH"
  exit 1
fi

echo "Linking local aiwrapper from $AIWRAPPER_PATH..."
cd "$AIWRAPPER_PATH"
npm link

cd "$SILA_DIR"
npm link aiwrapper

echo "✓ Linked to local aiwrapper package"
echo "To switch back: npm run aiwrapper:unlink"
