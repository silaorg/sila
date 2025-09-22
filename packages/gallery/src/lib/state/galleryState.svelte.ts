import type { Space } from "@sila/core";
import { clientState } from "@sila/client/state/clientState.svelte";
import { buildSpaceFromConfig } from "$lib/demo/buildSpaceFromConfig";

class GalleryState {
  ready: boolean = $state(false);
  error: string | null = $state(null);
  private initializing: boolean = false;
  private loadedFromUrl: string | null = null;

  currentSpace: Space | null = $derived(clientState.currentSpace);

  async init(demoConfigUrl: string = "/api/demo-space"): Promise<void> {
    await this.loadSpace(demoConfigUrl);
  }

  async loadSpace(demoConfigUrl: string): Promise<void> {
    if (this.initializing) return;
    if (this.ready && this.loadedFromUrl === demoConfigUrl) return;

    this.initializing = true;
    this.error = null;

    try {
      await clientState.init({});

      if (this.loadedFromUrl !== demoConfigUrl) {
        const cfg = await (await fetch(demoConfigUrl)).json();
        const built = await buildSpaceFromConfig(cfg);
        await clientState.adoptInMemorySpace(built, cfg.name);
        this.loadedFromUrl = demoConfigUrl;
      }

      this.ready = true;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.initializing = false;
    }
  }
}

export const galleryState = new GalleryState();


