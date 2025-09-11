# Download URL Generation for SvelteKit

Generate platform-specific download URLs using the GitHub Releases API in SvelteKit with Svelte 5.

## GitHub API Integration

Use the GitHub Releases API to fetch the latest release and generate download URLs:

```javascript
// lib/api/github.js
export async function getLatestRelease() {
  try {
    const response = await fetch('https://api.github.com/repos/silaorg/sila/releases/latest');
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch latest release:', error);
    return null;
  }
}

export function getDownloadUrl(release, platform) {
  if (!release?.assets) return null;
  
  const baseUrl = 'https://github.com/silaorg/sila/releases/latest/download';
  
  // Find the appropriate asset for the platform by file extension
  const asset = release.assets.find(asset => {
    const name = asset.name.toLowerCase();
    switch (platform) {
      case 'macos':
        return name.endsWith('.dmg');
      case 'windows':
        return name.endsWith('.exe');
      case 'linux':
        return name.endsWith('.appimage');
      default:
        return false;
    }
  });
  
  return asset ? asset.browser_download_url : `${baseUrl}/${getExpectedFilename(platform, release.tag_name)}`;
}

function getExpectedFilename(platform, version) {
  const cleanVersion = version.replace('v', '');
  const assets = {
    'macos': `Sila-${cleanVersion}-macos-universal.dmg`,
    'windows': `Sila-${cleanVersion}-windows-x64.exe`,
    'linux': `Sila-${cleanVersion}-linux-x64.AppImage`
  };
  return assets[platform];
}
```

## SvelteKit Page Implementation

### +page.server.js (Server-side data loading)

```javascript
// src/routes/download/+page.server.js
import { getLatestRelease } from '$lib/api/github.js';

export async function load() {
  const release = await getLatestRelease();
  
  return {
    release,
    version: release?.tag_name || 'v1.0.0',
    publishedAt: release?.published_at || new Date().toISOString()
  };
}
```

### +page.svelte (Svelte 5 component)

```svelte
<!-- src/routes/download/+page.svelte -->
<script>
  import { getDownloadUrl } from '$lib/api/github.js';
  import { Download, Apple, Windows, Linux } from 'lucide-svelte';
  
  let { data } = $props();
  
  // Platform detection
  let userPlatform = $state('macos');
  
  $effect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('mac')) userPlatform = 'macos';
      else if (ua.includes('win')) userPlatform = 'windows';
      else if (ua.includes('linux')) userPlatform = 'linux';
    }
  });
  
  // Generate download URLs
  const downloadUrls = $derived(() => {
    if (!data.release) return {};
    
    return {
      macos: getDownloadUrl(data.release, 'macos'),
      windows: getDownloadUrl(data.release, 'windows'),
      linux: getDownloadUrl(data.release, 'linux')
    };
  });
  
  // Platform-specific download URL
  const primaryDownloadUrl = $derived(() => downloadUrls[userPlatform]);
  
  // Platform names for display
  const platformNames = {
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux'
  };
  
  // Platform icons
  const platformIcons = {
    macos: Apple,
    windows: Windows,
    linux: Linux
  };
</script>

<svelte:head>
  <title>Download Sila - AI Chat Assistant</title>
  <meta name="description" content="Download Sila for macOS, Windows, or Linux. Own your AI chats and data." />
</svelte:head>

<div class="container mx-auto px-4 py-16">
  <div class="text-center mb-12">
    <h1 class="text-4xl font-bold mb-4">Download Sila</h1>
    <p class="text-xl text-gray-600 mb-8">
      Own your AI chats and data. Available for all platforms.
    </p>
    <div class="text-sm text-gray-500">
      Latest version: <span class="font-mono">{data.version}</span>
    </div>
  </div>

  <!-- Primary Download Button -->
  <div class="text-center mb-12">
    {#if primaryDownloadUrl}
      <a 
        href={primaryDownloadUrl} 
        class="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
      >
        <svelte:component this={platformIcons[userPlatform]} size={24} />
        Download for {platformNames[userPlatform]}
      </a>
    {/if}
  </div>

  <!-- Platform-specific Downloads -->
  <div class="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
    {#each Object.entries(platformNames) as [platform, name]}
      <div class="border rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
        <div class="mb-4">
          <svelte:component this={platformIcons[platform]} size={48} class="mx-auto text-gray-600" />
        </div>
        <h3 class="text-xl font-semibold mb-2">{name}</h3>
        <p class="text-gray-600 mb-4">
          {#if platform === 'macos'}
            Universal binary (Intel + Apple Silicon)
          {:else if platform === 'windows'}
            Windows 10/11 (64-bit)
          {:else}
            Linux AppImage (64-bit)
          {/if}
        </p>
        {#if downloadUrls[platform]}
          <a 
            href={downloadUrls[platform]}
            class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <Download size={16} />
            Download
          </a>
        {:else}
          <span class="text-gray-400">Coming soon</span>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Release Notes -->
  {#if data.release?.body}
    <div class="mt-16 max-w-4xl mx-auto">
      <h2 class="text-2xl font-bold mb-6">What's New in {data.version}</h2>
      <div class="prose max-w-none">
        {@html data.release.body.replace(/\r\n/g, '\n')}
      </div>
    </div>
  {/if}
</div>

<style>
  .prose {
    @apply text-gray-700 leading-relaxed;
  }
  
  .prose h3 {
    @apply text-lg font-semibold mt-6 mb-2;
  }
  
  .prose ul {
    @apply list-disc list-inside space-y-1;
  }
  
  .prose code {
    @apply bg-gray-100 px-2 py-1 rounded text-sm font-mono;
  }
</style>
```

## Alternative: Client-side API Integration

If you prefer client-side fetching:

```svelte
<!-- src/routes/download/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { getLatestRelease, getDownloadUrl } from '$lib/api/github.js';
  
  let release = $state(null);
  let loading = $state(true);
  let error = $state(null);
  
  onMount(async () => {
    try {
      release = await getLatestRelease();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });
  
  // Rest of component logic...
</script>

{#if loading}
  <div class="text-center py-16">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
    <p class="mt-4 text-gray-600">Loading latest release...</p>
  </div>
{:else if error}
  <div class="text-center py-16">
    <p class="text-red-600">Failed to load release information: {error}</p>
  </div>
{:else if release}
  <!-- Download UI -->
{/if}
```

## Key Features

- ✅ **Auto-detection**: Automatically detects user's platform
- ✅ **Dynamic URLs**: Always points to the latest release from [GitHub API](https://api.github.com/repos/silaorg/sila/releases/latest)
- ✅ **Svelte 5**: Uses modern Svelte 5 runes (`$state`, `$derived`, `$effect`)
- ✅ **Server-side**: Data loaded on the server for better SEO
- ✅ **Fallback support**: Graceful handling of missing assets
- ✅ **Responsive**: Clean, mobile-friendly download page

## Asset Detection Logic

The implementation finds the correct asset by file extension, making it robust and simple:

- **macOS**: Looks for any `.dmg` file
- **Windows**: Looks for any `.exe` file  
- **Linux**: Looks for any `.AppImage` file

This approach works with any naming convention and automatically adapts to:
- Current releases: `Supa_1.0.1_aarch64.dmg`
- Future normalized releases: `Sila-1.0.1-macos-universal.dmg`
- Any other naming pattern you might use

## Implementation Notes

1. **Server-side loading**: Uses `+page.server.js` for better performance and SEO
2. **Platform detection**: Client-side detection with `$effect` for reactivity
3. **Error handling**: Graceful fallbacks if API fails
4. **Styling**: Uses Tailwind CSS classes (adjust as needed)
5. **Icons**: Uses Lucide Svelte icons (install: `npm install lucide-svelte`)

## Testing

Test the implementation:
```bash
# Test the API directly
curl https://api.github.com/repos/silaorg/sila/releases/latest

# Test your download page
curl -I https://your-domain.com/download
```
