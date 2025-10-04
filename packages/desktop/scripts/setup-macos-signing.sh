#!/usr/bin/env bash
# Prepare a temporary macOS signing keychain from env-provided secrets

set -euo pipefail

# Required secrets/certs the script expects to be available in the environment
REQUIRED_VARS=(
  PROD_MACOS_CERTIFICATE
  PROD_MACOS_CERTIFICATE_PWD
  PROD_MACOS_CI_KEYCHAIN_PWD
  PROD_MACOS_CERTIFICATE_NAME
)

# Fail fast if any of the required variables are missing or empty
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "setup-macos-signing: missing required environment variable: $var" >&2
    exit 1
  fi
done

# Allow overriding the keychain name, but default to an ephemeral build keychain
KEYCHAIN_NAME="${MACOS_SIGNING_KEYCHAIN:-sila-build.keychain-db}"
KEYCHAIN_PATH="$HOME/Library/Keychains/$KEYCHAIN_NAME"

# Temporary directory to store the decoded certificate bundle
TMP_DIR="$(mktemp -d)"
CERT_PATH="$TMP_DIR/certificate.p12"

# Ensure the temporary directory is cleaned up on exit or error
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# Decode the base64-encoded .p12 certificate into the temp directory
printf '%s' "$PROD_MACOS_CERTIFICATE" | base64 --decode > "$CERT_PATH"

# Remove any stale keychain from previous runs (ignore errors if it doesn't exist)
if [ -f "$KEYCHAIN_PATH" ]; then
  security delete-keychain "$KEYCHAIN_NAME" >/dev/null 2>&1 || true
fi

# Create, configure, and unlock the dedicated signing keychain
security create-keychain -p "$PROD_MACOS_CI_KEYCHAIN_PWD" "$KEYCHAIN_NAME"
security set-keychain-settings -lut 21600 "$KEYCHAIN_NAME"
security unlock-keychain -p "$PROD_MACOS_CI_KEYCHAIN_PWD" "$KEYCHAIN_NAME"
# Import the certificate into the keychain so codesign can access it
security import "$CERT_PATH" -k "$KEYCHAIN_NAME" -P "$PROD_MACOS_CERTIFICATE_PWD" -T /usr/bin/codesign
# Grant codesign permission to use the key without GUI prompts and make it default
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$PROD_MACOS_CI_KEYCHAIN_PWD" "$KEYCHAIN_NAME"
security default-keychain -s "$KEYCHAIN_NAME"

# Double-check the identity is present; fail early if not
security find-identity -v "$KEYCHAIN_NAME" >/dev/null 2>&1 || {
  echo "setup-macos-signing: signing identity not found in $KEYCHAIN_NAME" >&2
  exit 1
}

echo "macOS signing keychain ready: $KEYCHAIN_NAME"

