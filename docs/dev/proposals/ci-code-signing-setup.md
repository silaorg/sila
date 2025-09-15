# CI Code Signing Setup Proposal

## Overview
Complete the CI code signing setup for macOS notarization and add signing for Windows/Linux platforms.

## Current State
- **macOS**: ⚠️ Certificate secrets not set up, workflow configured but needs secrets
- **Windows**: Builds unsigned in CI
- **Linux**: Builds unsigned in CI

## Immediate Next Steps (macOS Setup)

### 1. Export macOS Certificate from Keychain
Run these commands on your Mac to export your Developer ID Application certificate:

```bash
# Find your certificate name first
security find-identity -v -p codesigning

# Export the certificate (replace with your actual certificate name)
security export -t identities -f pkcs12 -k ~/Library/Keychains/login.keychain-db -o sila-certificate.p12 "Developer ID Application: Dmitrii Kurilchenko (UY76UFAS3C)"

# Convert to base64 for GitHub
base64 -i sila-certificate.p12 | pbcopy
```

### 2. Set up GitHub Secrets
Go to: `https://github.com/silaorg/sila/settings/secrets/actions`

Add these secrets:
- **`PROD_MACOS_CERTIFICATE`**: The base64 string from step 1 (paste from clipboard)
- **`PROD_MACOS_CERTIFICATE_PWD`**: Password you used when exporting the certificate
- **`PROD_MACOS_CERTIFICATE_NAME`**: Exact certificate name (e.g., "Developer ID Application: Dmitrii Kurilchenko (UY76UFAS3C)")
- **`PROD_MACOS_CI_KEYCHAIN_PWD`**: Random password for CI keychain (generate one)
- **`APPLE_APP_SPECIFIC_PASSWORD`**: App-specific password from https://appleid.apple.com/account/manage

### 3. Test the Complete Workflow
- Create a test tag: `git tag v0.0.0-test && git push origin v0.0.0-test`
- Trigger the `release-2-build-upload` workflow manually
- Verify macOS build is signed and notarized

### 4. Verify Notarization
```bash
spctl --assess --verbose /path/to/Sila.dmg
```

## Future Enhancements

### Windows Code Signing
**Requirements:**
- Code Signing Certificate from trusted CA (DigiCert, Sectigo, etc.)
- Must be in .pfx format

**GitHub Secrets Needed:**
- `WINDOWS_CERTIFICATE`: Base64-encoded .pfx certificate file
- `WINDOWS_CERTIFICATE_PWD`: Password for the certificate

**Workflow Addition:**
```yaml
- name: Package Windows artifacts (signed)
  if: runner.os == 'Windows'
  env:
    CSC_LINK: ${{ secrets.WINDOWS_CERTIFICATE }}
    CSC_KEY_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PWD }}
    CSC_IDENTITY_AUTO_DISCOVERY: false
```

### Linux GPG Signing
**Requirements:**
- GPG signing key for package signing

**GitHub Secrets Needed:**
- `LINUX_SIGNING_KEY`: Base64-encoded private GPG key
- `LINUX_SIGNING_PASSPHRASE`: Passphrase for the GPG key

## Timeline
- **Phase 1**: Complete macOS notarization (1 day) - **CURRENT**
- **Phase 2**: Windows certificate procurement (1-2 weeks)
- **Phase 3**: Windows signing implementation (1-2 days)
- **Phase 4**: Linux GPG signing setup (1-2 days)

## Success Criteria
- macOS builds are signed and notarized ✅
- Windows builds pass SmartScreen validation (future)
- Linux builds are GPG signed (future)
- No manual intervention required for releases