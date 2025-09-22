import type { Space } from "@sila/core";
import { ClientState } from "@sila/client";
import { buildSpaceFromConfig } from "$lib/demo/buildSpaceFromConfig";

class GalleryState {
  ready: boolean = $state(false);
  error: string | null = $state(null);
  private initializing: boolean = false;
  private loadedFromUrl: string | null = null;

  private _client: ClientState = $state(new ClientState());
  currentSpace: Space | null = $derived(this._client.currentSpace);

  async init(demoConfigUrl: string = "/api/demo-space"): Promise<void> {
    await this.loadSpace(demoConfigUrl);
  }

  setClient(state: ClientState) {
    this._client = state;
  }

  async loadSpace(demoConfigUrl: string): Promise<void> {
    if (this.initializing) return;
    if (this.ready && this.loadedFromUrl === demoConfigUrl) return;

    this.initializing = true;
    this.error = null;

    try {
      await this._client.init({});

      if (this.loadedFromUrl !== demoConfigUrl) {
        const cfg = await (await fetch(demoConfigUrl)).json();
        const built = await buildSpaceFromConfig(cfg);
        await this._client.adoptInMemorySpace(built, cfg.name);
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


