<script lang="ts">
  import CenteredPage from "@sila/client/comps/basic/CenteredPage.svelte";
  import SpaceOpener from "../spaces/SpaceOpener.svelte";
  import { i18n } from "@sila/client";
</script>

<CenteredPage width="2xl">
  <div class="card p-8 mt-4 space-y-6 selectable-text">
    <div class="space-y-4">
      <h2 class="h2">{i18n.texts.wizards.freshStartTitle}</h2>
      <p>
        {i18n.texts.wizards.freshStartDescription}
      </p>
    </div>

    <h3 class="h3">{i18n.texts.wizards.workspaceTitle}</h3>
    <p>
      {i18n.texts.wizards.workspaceDescription}
    </p>
    <SpaceOpener />
  </div>
</CenteredPage>
