# Download URL Generation

With normalized asset names, you can generate predictable download URLs for different platforms.

## Normalized Asset Names

After updating `package.json` with `artifactName` patterns:

- **macOS**: `Sila-${version}-macos-universal.dmg`
- **Windows**: `Sila-${version}-windows-x64.exe` 
- **Linux**: `Sila-${version}-linux-x64.AppImage`

## Backend Implementation Examples

### Node.js/Express

```javascript
const express = require('express');
const { execSync } = require('child_process');

const app = express();

// Get latest version from package.json or GitHub API
function getLatestVersion() {
  try {
    // Option 1: From local package.json
    const pkg = require('./packages/desktop/package.json');
    return pkg.version;
    
    // Option 2: From GitHub API
    // const response = await fetch('https://api.github.com/repos/silaorg/sila/releases/latest');
    // const release = await response.json();
    // return release.tag_name.replace('v', '');
  } catch (error) {
    return '1.0.0'; // fallback
  }
}

// Generate download URL for platform
function getDownloadUrl(platform, version) {
  const baseUrl = 'https://github.com/silaorg/sila/releases/latest/download';
  
  const assets = {
    'macos': `Sila-${version}-macos-universal.dmg`,
    'windows': `Sila-${version}-windows-x64.exe`,
    'linux': `Sila-${version}-linux-x64.AppImage`
  };
  
  return `${baseUrl}/${assets[platform]}`;
}

// Detect platform from User-Agent
function detectPlatform(userAgent) {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'macos'; // default
}

// Download endpoint
app.get('/download', (req, res) => {
  const platform = detectPlatform(req.headers['user-agent']);
  const version = getLatestVersion();
  const downloadUrl = getDownloadUrl(platform, version);
  
  res.redirect(downloadUrl);
});

// Platform-specific endpoints
app.get('/download/macos', (req, res) => {
  const version = getLatestVersion();
  res.redirect(getDownloadUrl('macos', version));
});

app.get('/download/windows', (req, res) => {
  const version = getLatestVersion();
  res.redirect(getDownloadUrl('windows', version));
});

app.get('/download/linux', (req, res) => {
  const version = getLatestVersion();
  res.redirect(getDownloadUrl('linux', version));
});
```

### Python/Flask

```python
from flask import Flask, redirect, request
import requests
import re

app = Flask(__name__)

def get_latest_version():
    """Get latest version from GitHub API"""
    try:
        response = requests.get('https://api.github.com/repos/silaorg/sila/releases/latest')
        release = response.json()
        return release['tag_name'].replace('v', '')
    except:
        return '1.0.0'  # fallback

def get_download_url(platform, version):
    """Generate download URL for platform"""
    base_url = 'https://github.com/silaorg/sila/releases/latest/download'
    
    assets = {
        'macos': f'Sila-{version}-macos-universal.dmg',
        'windows': f'Sila-{version}-windows-x64.exe',
        'linux': f'Sila-{version}-linux-x64.AppImage'
    }
    
    return f'{base_url}/{assets[platform]}'

def detect_platform(user_agent):
    """Detect platform from User-Agent"""
    ua = user_agent.lower()
    if 'mac' in ua:
        return 'macos'
    elif 'win' in ua:
        return 'windows'
    elif 'linux' in ua:
        return 'linux'
    return 'macos'  # default

@app.route('/download')
def download():
    platform = detect_platform(request.headers.get('User-Agent', ''))
    version = get_latest_version()
    return redirect(get_download_url(platform, version))

@app.route('/download/<platform>')
def download_platform(platform):
    version = get_latest_version()
    return redirect(get_download_url(platform, version))
```

## Frontend Integration

```html
<!-- Auto-detect platform -->
<a href="/download" class="download-btn">
  Download for <span id="platform">macOS</span>
</a>

<!-- Platform-specific buttons -->
<a href="/download/macos" class="download-btn macos">Download for macOS</a>
<a href="/download/windows" class="download-btn windows">Download for Windows</a>
<a href="/download/linux" class="download-btn linux">Download for Linux</a>

<script>
// Update platform text
document.addEventListener('DOMContentLoaded', () => {
  const platform = detectPlatform();
  const platformNames = {
    'macos': 'macOS',
    'windows': 'Windows',
    'linux': 'Linux'
  };
  document.getElementById('platform').textContent = platformNames[platform];
});

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'macos';
}
</script>
```

## Benefits

- ✅ **Predictable URLs**: Easy to generate and maintain
- ✅ **Platform detection**: Automatic or manual platform selection
- ✅ **Version agnostic**: Always points to latest release
- ✅ **Fallback support**: Graceful handling of missing assets
- ✅ **SEO friendly**: Clean, readable URLs

## Testing

Test the URLs work:
```bash
# These should redirect to the actual files
curl -I https://your-domain.com/download/macos
curl -I https://your-domain.com/download/windows  
curl -I https://your-domain.com/download/linux
```
