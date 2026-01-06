<script lang="ts">
  import { i18n } from "@sila/client";
  import { useClientState } from "@sila/client/state/clientStateContext";
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import WorkspaceLanguageSwitcher from "@sila/client/comps/settings/WorkspaceLanguageSwitcher.svelte";
  import type { Vertex } from "@sila/core";

  const clientState = useClientState();
  const pointer = $derived(clientState.currentSpaceState?.pointer ?? null);
  const space = $derived(clientState.currentSpace ?? null);
  const settingsVertex = $derived((space?.getVertexByPath("settings") as Vertex | undefined) ?? null);

  let workspaceName = $state("");
  let workspaceDescription = $state("");
  let isEditingName = $state(false);
  let isEditingDescription = $state(false);

  let lastSpaceId: string | null = $state(null);

  function applyFromSpace() {
    workspaceName = pointer?.name ?? "";

    const desc = settingsVertex?.getProperty("description");
    workspaceDescription = typeof desc === "string" ? desc : "";
  }

  $effect(() => {
    const spaceId = pointer?.id ?? null;
    if (spaceId === lastSpaceId) return;
    lastSpaceId = spaceId;
    applyFromSpace();
  });

  $effect(() => {
    if (!settingsVertex) return;

    const apply = () => {
      if (!isEditingDescription) {
        const desc = settingsVertex.getProperty("description");
        workspaceDescription = typeof desc === "string" ? desc : "";
      }
    };

    apply();

    const unobserve = settingsVertex.observe((events) => {
      if (events.some((e) => e.type === "property")) {
        apply();
      }
    });

    return () => unobserve();
  });

  $effect(() => {
    if (!space?.tree.root) return;

    const apply = () => {
      if (!isEditingName) {
        workspaceName = space.name ?? "";
      }
    };

    apply();

    const unobserve = space.tree.root.observe((events) => {
      if (events.some((e) => e.type === "property")) {
        apply();
      }
    });

    return () => unobserve();
  });

  async function commitName() {
    if (!pointer) return;

    const next = workspaceName.trim();
    const prev = pointer.name ?? "";
    if (next === prev) return;

    await clientState.updateSpaceName(pointer.id, next);
  }

  function commitDescription() {
    if (!settingsVertex) return;

    const next = workspaceDescription.trim();
    const prev = settingsVertex.getProperty("description");
    const prevStr = typeof prev === "string" ? prev : "";
    if (next === prevStr) return;

    settingsVertex.setProperty("description", next);
  }
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />

  <div class="flex-1 space-y-4">
    <p class="text-sm">
      You can describe your workspace here for AI and select the UI and AI's language.
    </p>
    <div class="space-y-4">
      <label class="label">
        <span>{i18n.texts.settingsPage.appearance.language}</span>
        <WorkspaceLanguageSwitcher />
      </label>

      <label class="label">
        <span>{i18n.texts.basics.name}</span>
        <input
          class="input"
          type="text"
          bind:value={workspaceName}
          placeholder={pointer?.name ?? ""}
          disabled={!pointer}
          onfocus={() => (isEditingName = true)}
          onblur={async () => {
            isEditingName = false;
            await commitName();
          }}
        />
      </label>

      <label class="label">
        <span>Workspace description</span>
        <textarea
          class="textarea"
          rows="5"
          bind:value={workspaceDescription}
          placeholder="Describe what this workspace is for or any preferences for the assistants in plain text"
          disabled={!pointer}
          onfocus={() => (isEditingDescription = true)}
          onblur={() => {
            isEditingDescription = false;
            commitDescription();
          }}
        ></textarea>
      </label>

      <div class="grid gap-2">
        {#if pointer}
          <div class="text-sm grid gap-1">
            <div><span class="text-surface-600-300">Location:</span> <span class="font-mono">{pointer.uri}</span></div>
          </div>
        {:else}
          <div class="text-sm text-surface-600-300">
            No workspace loaded.
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

