#!/bin/bash

# Create desktop build zip for GitHub release
# Usage: ./scripts/create-desktop-build.sh [version]

set -e

VERSION=${1:-$(node -p "require('./package.json').version")}
BUILD_DIR="build"
ZIP_NAME="desktop-v${VERSION}.zip"
OUTPUT_DIR="dist-desktop-builds"

echo "Creating desktop build zip for version: $VERSION"

# Ensure we're in the right directory
if [ ! -f "package.json" ]; then
  echo "Error: package.json not found. Run this script from the desktop package directory."
  exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
  echo "Build directory not found. Running build..."
  npm run build
fi

# Verify build directory has content
if [ ! -f "$BUILD_DIR/index.html" ]; then
  echo "Error: index.html not found in build directory. Build may have failed."
  exit 1
fi

# Create zip file
echo "Creating zip file: $ZIP_NAME"
cd "$BUILD_DIR"
zip -r "../$OUTPUT_DIR/$ZIP_NAME" . -x "*.DS_Store" "*/.*"
cd ..

# Verify zip was created
if [ -f "$OUTPUT_DIR/$ZIP_NAME" ]; then
  ZIP_SIZE=$(du -h "$OUTPUT_DIR/$ZIP_NAME" | cut -f1)
  echo "✅ Created $ZIP_NAME ($ZIP_SIZE)"
  echo "📁 Output: $OUTPUT_DIR/$ZIP_NAME"
  echo ""
  echo "To upload to GitHub release:"
  echo "1. Go to https://github.com/silaorg/sila/releases"
  echo "2. Edit the latest release"
  echo "3. Upload $OUTPUT_DIR/$ZIP_NAME as an asset"
else
  echo "❌ Failed to create zip file"
  exit 1
fi