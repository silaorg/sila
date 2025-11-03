<script lang="ts">
  import { onMount } from 'svelte';
  import { X, Download } from 'lucide-svelte';
  import { getFilePreviewConfig, formatFileSize, FILE_PREVIEW_CONFIGS } from '@sila/client/utils/filePreview';
  import { useClientState } from '../../state/clientStateContext';

  const clientState = useClientState();
  let activeFile = $derived(clientState.gallery.activeFile);
  let isOpen = $derived(clientState.gallery.isOpen);
  let lineCount = $state<number | null>(null);
  let isLoadingLines = $state(false);

  let previewConfig = $derived.by(() => {
    if (!activeFile?.mimeType) return null;
    return getFilePreviewConfig(activeFile.mimeType);
  });

  function getDownloadFilename(): string {
    if (!activeFile) return 'file';
    const name = activeFile.name;
    const ext = name.split('.').pop();
    
    // If filename already has an extension, use it as is
    if (ext && ext !== name) {
      return name;
    }
    
    // Otherwise, try to infer extension from mimeType
    if (activeFile.mimeType) {
      const config = FILE_PREVIEW_CONFIGS[activeFile.mimeType];
      if (config && config.supportedFormats.length > 0) {
        return `${name}.${config.supportedFormats[0]}`;
      }
    }
    
    return name;
  }

  async function getLineCount(fileUrl: string): Promise<number | null> {
    try {
      isLoadingLines = true;
      const response = await fetch(fileUrl);
      if (!response.ok) return null;
      
      const text = await response.text();
      // Count lines (split by newlines and filter out empty lines)
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      return lines.length;
    } catch (error) {
      console.warn('Failed to get line count:', error);
      return null;
    } finally {
      isLoadingLines = false;
    }
  }

  import { closeStack } from '@sila/client/utils/closeStack';

  function handleBackdropClick(event: Event) {
    if (event.target === event.currentTarget) {
      clientState.gallery.close();
    }
  }

  async function handleDownload() {
    if (!activeFile) return;
    
    try {
      // Fetch the file as a blob
      const response = await fetch(activeFile.url);
      if (!response.ok) {
        console.error('Failed to fetch file for download');
        return;
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = getDownloadFilename();
      link.click();
      
      // Clean up the object URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }

  onMount(() => { return () => {}; });

  // Get line count when text file is opened
  $effect(() => {
    if (isOpen && activeFile && (previewConfig?.previewType === 'text' || previewConfig?.previewType === 'code')) {
      lineCount = null;
      getLineCount(activeFile.url).then(count => {
        lineCount = count;
      });
    }
  });
</script>

{#if isOpen && activeFile && previewConfig}
  <div 
    class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-default"
    onclick={handleBackdropClick}
    use:closeStack={() => {
      if (!clientState.gallery.isOpen) return false;
      clientState.gallery.close();
      return true;
    }}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleBackdropClick(e);
      }
    }}
    tabindex="0"
    role="button"
    aria-label="Close gallery"
  >
    <!-- Close button -->
    <button 
      class="absolute top-4 right-4 btn-icon bg-black/50 text-white hover:bg-black/70 z-10"
      onclick={() => clientState.gallery.close()}
    >
      <X size={20} />
    </button>

    <!-- Download button -->
    <button 
      class="absolute top-16 right-4 btn-icon bg-black/50 text-white hover:bg-black/70 z-10"
      onclick={handleDownload}
    >
      <Download size={20} />
    </button>

    <!-- Content -->
    <div class="relative max-w-full max-h-full p-8">
      {#if previewConfig.previewType === 'image'}
        <img 
          src={activeFile.url} 
          alt={activeFile.name}
          class="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)] object-contain"
        />
      {:else if previewConfig.previewType === 'video'}
        <video 
          src={activeFile.url} 
          controls 
          class="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)]"
          autoplay
        >
          <track kind="captions" />
        </video>
      {:else if previewConfig.previewType === 'pdf'}
        <iframe 
          src={activeFile.url} 
          class="border-0"
          title={activeFile.name}
        ></iframe>
      {:else if previewConfig.previewType === 'text' || previewConfig.previewType === 'code'}
        <div class="bg-white text-black p-8 rounded text-center max-w-md">
          <div class="text-6xl mb-4">{previewConfig.icon}</div>
          <h3 class="text-xl font-medium mb-2">{activeFile.name}</h3>
          <div class="text-gray-600 mb-4 space-y-1">
            {#if activeFile.size !== undefined}
              <p>Size: {formatFileSize(activeFile.size)}</p>
            {/if}
            {#if isLoadingLines}
              <p>Loading line count...</p>
            {:else if lineCount !== null}
              <p>Lines: {lineCount.toLocaleString()}</p>
            {/if}
          </div>
          <button 
            class="btn preset-filled-primary-500" 
            onclick={handleDownload}
          >
            Download File
          </button>
        </div>
      {:else}
        <div class="bg-white text-black p-8 rounded text-center max-w-md">
          <div class="text-6xl mb-4">{previewConfig.icon}</div>
          <h3 class="text-xl font-medium mb-2">{activeFile.name}</h3>
          <p class="text-gray-600 mb-4">
            This file type cannot be previewed
          </p>
          <button 
            class="btn preset-filled-primary-500" 
            onclick={handleDownload}
          >
            Download File
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
