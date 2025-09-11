# Manual macOS Build and Upload

When CI macOS builds are not available or you need to build locally, follow these steps.

## Prerequisites

- macOS development environment
- Apple Developer certificate installed in keychain
- `.env` file in `packages/desktop/` with Apple credentials:
  ```
  APPLE_ID=your-email@example.com
  APPLE_TEAM_ID=YOUR_TEAM_ID
  APPLE_APP_SPECIFIC_PASSWORD=your-app-specific-password
  ```

## Build Steps

```bash
# From repo root
cd packages/desktop
npm run package:mac
```

This will:
- Build the universal macOS app (Intel + Apple Silicon)
- Sign it with your Developer ID certificate
- Notarize it with Apple
- Create a DMG in `dist/` directory

## Upload to Draft Release

```bash
# From repo root
gh release upload vX.Y.Z packages/desktop/dist/*.dmg --clobber
```

Replace `vX.Y.Z` with the actual release tag.

## Verify Notarization

Check that your app was successfully notarized:

```bash
xcrun notarytool history --apple-id your-email@example.com --password your-app-specific-password
```

## Troubleshooting

### Certificate Issues
If you get certificate errors:
```bash
# List available certificates
security find-identity -v -p codesigning

# Verify your certificate is valid
security find-identity -v -p codesigning | grep "Developer ID Application"
```

### Notarization Issues
If notarization fails:
```bash
# Check notarization logs
xcrun notarytool log <submission-id> --apple-id your-email@example.com --password your-app-specific-password
```

### Build Issues
If the build fails:
```bash
# Clean and rebuild
rm -rf dist/
npm run package:mac
```

## Notes

- The build creates a universal DMG that works on both Intel and Apple Silicon Macs
- Notarization can take 5-15 minutes to complete
- Make sure your Apple Developer account is in good standing
