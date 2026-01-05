<script lang="ts">
  import CenteredPage from "@sila/client/comps/basic/CenteredPage.svelte";
  import LanguageSwitcher from "@sila/client/comps/settings/LanguageSwitcher.svelte";
  import SpaceOpener from "../spaces/SpaceOpener.svelte";
  import { i18n } from "@sila/client";

  type Step = "welcome" | "workspace";
  let step: Step = $state("welcome");
</script>

<CenteredPage width="2xl">
  {#if step === "workspace"}
    <div class="fixed bottom-3 left-3 sm:bottom-4 sm:left-4 z-50 mb-[env(safe-area-inset-bottom)]">
      <LanguageSwitcher compact />
    </div>
  {/if}

  <div class="min-h-[calc(100vh-1rem)] flex items-center justify-center py-10">
    <div class="card p-8 w-full space-y-6 selectable-text">
      {#if step === "welcome"}
        <div class="space-y-4 text-center">
          <img
            src="/logo.png"
            alt="Sila"
            class="w-20 h-20 mx-auto mb-2 select-none"
            draggable="false"
          />
          <h2 class="h2">{i18n.texts.wizards.freshStartTitle}</h2>
          <p>
            {i18n.texts.wizards.freshStartDescription}
          </p>
        </div>

        <div class="pt-2 flex flex-col gap-3 w-full sm:max-w-xs mx-auto">
          <LanguageSwitcher />
          <button
            class="btn preset-filled-primary-500 w-full"
            onclick={() => (step = "workspace")}
          >
            {i18n.texts.wizards.getStartedButton}
          </button>
        </div>
      {:else}
        <div class="space-y-6">
          <div class="space-y-3">
            <img
              src="/icons/Square310x310Logo.png"
              alt="Sila"
              class="w-14 h-14 mx-auto sm:hidden select-none"
              draggable="false"
            />
            <h3 class="h3">{i18n.texts.wizards.workspaceTitle}</h3>
            <p>
              {i18n.texts.wizards.workspaceDescription}
            </p>
          </div>
          <SpaceOpener />
        </div>
      {/if}
    </div>
  </div>
</CenteredPage>
