<script lang="ts">
  import { GalleryComponent } from '$lib';
  import { ClientState, ClientStateProvider } from '@sila/client';
  import ChatAppInGallery from '$lib/comps/ChatAppInGallery.svelte';

  const stateA = new ClientState();
  const stateB = new ClientState();
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
  <div class="border rounded">
    <GalleryComponent state={stateA}>
      <ClientStateProvider instance={stateA}>
        <ChatAppInGallery />
      </ClientStateProvider>
    </GalleryComponent>
  </div>
  <div class="border rounded">
    <GalleryComponent state={stateB}>
      <ClientStateProvider instance={stateB}>
        <ChatAppInGallery />
      </ClientStateProvider>
    </GalleryComponent>
  </div>
  </div>

