# CI Code Signing Setup Proposal

## Overview
Set up automated code signing and notarization in GitHub Actions for both macOS and Windows builds to eliminate manual signing steps and ensure all releases are properly signed.

## Current State
- macOS: Builds unsigned in CI, requires manual local signing
- Windows: Builds unsigned in CI
- Both platforms need proper certificates for distribution

## Goals
- Automate code signing for both macOS and Windows in CI
- Enable notarization for macOS builds
- Remove manual signing steps from release process
- Ensure all releases are properly signed and trusted

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
- `CSC_LINK`: Base64-encoded .p12 certificate file
- `CSC_KEY_PASSWORD`: Password used when exporting certificate
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password for notarization (already set)
- `APPLE_ID`: Apple ID email (already set as repository variable)
- `APPLE_TEAM_ID`: Apple Team ID (already set as repository variable)

#### 3. Workflow Configuration
```yaml
- name: Package macOS artifacts (signed & notarized)
  if: runner.os == 'macOS'
  env:
    ELECTRON_BUILDER_DISABLE_PUBLISH: true
    APPLE_ID: ${{ vars.APPLE_ID }}
    APPLE_TEAM_ID: ${{ vars.APPLE_TEAM_ID }}
    APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
    CSC_IDENTITY_AUTO_DISCOVERY: false
```

### Windows Signing

#### 1. Certificate Requirements
- Code Signing Certificate from a trusted CA (DigiCert, Sectigo, etc.)
- Must be in .pfx format for Windows
- Should be valid for at least 1 year

#### 2. GitHub Secrets Required
- `CSC_LINK`: Base64-encoded .pfx certificate file
- `CSC_KEY_PASSWORD`: Password for the certificate
- `CSC_NAME`: Subject name of the certificate (optional, for auto-discovery)

#### 3. Workflow Configuration
```yaml
- name: Package Windows artifacts (signed)
  if: runner.os == 'Windows'
  env:
    ELECTRON_BUILDER_DISABLE_PUBLISH: true
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
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
2. Update macOS workflow configuration
3. Test macOS signing and notarization
4. Obtain Windows code signing certificate
5. Add Windows certificate to GitHub Secrets
6. Update Windows workflow configuration
7. Test both platforms end-to-end

## Testing Strategy
- Create test releases with both platforms
- Verify signatures using OS tools
- Test notarization status for macOS
- Validate installer behavior on clean systems

## Rollback Plan
- Keep current unsigned build capability as fallback
- Use workflow inputs to enable/disable signing
- Maintain local signing scripts for emergency releases

## Timeline
- **Phase 1**: macOS signing setup (1-2 days)
- **Phase 2**: Windows certificate procurement (1-2 weeks)
- **Phase 3**: Windows signing implementation (1-2 days)
- **Phase 4**: Testing and validation (1 week)

## Success Criteria
- All CI builds are properly signed
- macOS builds are notarized and trusted
- Windows builds pass SmartScreen validation
- Release process is fully automated
- No manual intervention required for releases
