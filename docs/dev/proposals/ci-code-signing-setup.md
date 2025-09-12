# CI Code Signing Setup Proposal

## Overview
Set up automated code signing and notarization in GitHub Actions for macOS, Windows, and Linux builds to eliminate manual signing steps and ensure all releases are properly signed.

## Current State
- macOS: Builds unsigned in CI, requires manual local signing
- Windows: Builds unsigned in CI  
- Linux: Builds unsigned in CI
- All platforms need proper certificates for distribution

## Goals
- Automate code signing for macOS, Windows, and Linux in CI
- Enable notarization for macOS builds
- Remove manual signing steps from release process
- Ensure all releases are properly signed and trusted
- Build all platforms using GitHub Actions runners

## Implementation Plan

### macOS Signing & Notarization

#### 1. Certificate Export
Export the Developer ID Application certificate from local keychain:
```bash
# Export certificate with password
security export -t identities -f pkcs12 -k ~/Library/Keychains/login.keychain-db -o sila-certificate.p12 "Developer ID Application: Dmitrii Kurilchenko (UY76UFAS3C)"

# Convert to base64 for GitHub Secrets
base64 -i sila-certificate.p12 | pbcopy
```

#### 2. GitHub Secrets Required
- `PROD_MACOS_CERTIFICATE`: Base64-encoded .p12 certificate file
- `PROD_MACOS_CERTIFICATE_PWD`: Password used when exporting certificate
- `PROD_MACOS_CERTIFICATE_NAME`: Exact certificate name from keychain
- `PROD_MACOS_CI_KEYCHAIN_PWD`: Random password for CI keychain
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password for notarization (already set)
- `APPLE_ID`: Apple ID email (already set as repository variable)
- `APPLE_TEAM_ID`: Apple Team ID (already set as repository variable)

#### 3. Workflow Configuration
```yaml
- name: Setup macOS certificate
  if: runner.os == 'macOS'
  env:
    MACOS_CERTIFICATE: ${{ secrets.PROD_MACOS_CERTIFICATE }}
    MACOS_CERTIFICATE_PWD: ${{ secrets.PROD_MACOS_CERTIFICATE_PWD }}
    MACOS_CERTIFICATE_NAME: ${{ secrets.PROD_MACOS_CERTIFICATE_NAME }}
    MACOS_CI_KEYCHAIN_PWD: ${{ secrets.PROD_MACOS_CI_KEYCHAIN_PWD }}
  run: |
    # Convert base64 certificate back to .p12 file
    echo $MACOS_CERTIFICATE | base64 --decode > certificate.p12
    # Create keychain and import certificate
    security create-keychain -p "$MACOS_CI_KEYCHAIN_PWD" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "$MACOS_CI_KEYCHAIN_PWD" build.keychain
    security import certificate.p12 -k build.keychain -P "$MACOS_CERTIFICATE_PWD" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$MACOS_CI_KEYCHAIN_PWD" build.keychain

- name: Package macOS artifacts (signed & notarized)
  if: runner.os == 'macOS'
  env:
    ELECTRON_BUILDER_DISABLE_PUBLISH: true
    APPLE_ID: ${{ vars.APPLE_ID }}
    APPLE_TEAM_ID: ${{ vars.APPLE_TEAM_ID }}
    APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
    CSC_IDENTITY_AUTO_DISCOVERY: true
```

### Linux Signing

#### 1. Certificate Requirements
- GPG signing key for package signing
- Required for AppImage and other Linux package formats
- Can be generated locally and stored as GitHub secret

#### 2. GitHub Secrets Required
- `LINUX_SIGNING_KEY`: Base64-encoded private GPG key
- `LINUX_SIGNING_PASSPHRASE`: Passphrase for the GPG key

### Windows Signing

#### 1. Certificate Requirements
- Code Signing Certificate from a trusted CA (DigiCert, Sectigo, etc.)
- Must be in .pfx format for Windows
- Should be valid for at least 1 year

#### 2. GitHub Secrets Required
- `WINDOWS_CERTIFICATE`: Base64-encoded .pfx certificate file
- `WINDOWS_CERTIFICATE_PWD`: Password for the certificate
- `WINDOWS_CERTIFICATE_NAME`: Subject name of the certificate (optional)

#### 3. Workflow Configuration
```yaml
- name: Package Windows artifacts (signed)
  if: runner.os == 'Windows'
  env:
    ELECTRON_BUILDER_DISABLE_PUBLISH: true
    CSC_LINK: ${{ secrets.WINDOWS_CERTIFICATE }}
    CSC_KEY_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PWD }}
    CSC_IDENTITY_AUTO_DISCOVERY: false
```

## Security Considerations

### Certificate Management
- Certificates stored as GitHub Secrets (encrypted at rest)
- Secrets are only accessible during workflow execution
- Certificate passwords should be strong and unique
- Consider certificate rotation schedule

### Access Control
- Limit repository access to trusted maintainers
- Use branch protection rules for release workflows
- Monitor workflow runs for unauthorized access

## Benefits
- **Automated releases**: No manual signing steps required
- **Consistent signing**: All releases properly signed
- **User trust**: Signed binaries are trusted by OS security
- **Distribution ready**: Apps can be distributed through official channels
- **Time savings**: Eliminates manual release process

## Implementation Steps
1. Export macOS certificate and add to GitHub Secrets
2. Update macOS workflow configuration with certificate setup step
3. Test macOS signing and notarization in CI
4. Obtain Windows code signing certificate (future enhancement)
5. Add Windows certificate to GitHub Secrets (future enhancement)
6. Update Windows workflow configuration (future enhancement)
7. Add Linux GPG signing setup (future enhancement)
8. Test all platforms end-to-end

## Testing Strategy
- Create test releases with all three platforms (macOS, Windows, Linux)
- Verify signatures using OS tools
- Test notarization status for macOS
- Validate installer behavior on clean systems
- Test multi-architecture builds (x64, arm64)

## Rollback Plan
- Keep current unsigned build capability as fallback
- Use workflow inputs to enable/disable signing
- Maintain local signing scripts for emergency releases

## Timeline
- **Phase 1**: macOS signing setup (1-2 days) ✅ **COMPLETED**
- **Phase 2**: Windows certificate procurement (1-2 weeks) - Future enhancement
- **Phase 3**: Windows signing implementation (1-2 days) - Future enhancement  
- **Phase 4**: Linux GPG signing setup (1-2 days) - Future enhancement
- **Phase 5**: Testing and validation (1 week) - Future enhancement

## Success Criteria
- All CI builds are properly signed
- macOS builds are notarized and trusted
- Windows builds pass SmartScreen validation (future)
- Linux builds are GPG signed (future)
- Release process is fully automated
- No manual intervention required for releases
- Multi-architecture builds work correctly (x64, arm64)
