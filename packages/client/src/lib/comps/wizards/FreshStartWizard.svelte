<script lang="ts">
  import CenteredPage from "@sila/client/comps/basic/CenteredPage.svelte";
  import SpaceOpener from "../spaces/SpaceOpener.svelte";
</script>

<CenteredPage width="2xl">
  <div class="card p-8 mt-4 space-y-6 selectable-text">
    <div class="space-y-4">
      <h2 class="h2">Welcome to Sila</h2>
      <p>
        Sila works like ChatGPT, but in Sila you own your assistants, chats, and
        all generated data. As you use AI more, as it learns more about you and
        your preferences - that data becomes more valuable over time - so it
        makes sense to own it!
      </p>
    </div>

    <h3 class="h3">Create or open a workspace</h3>
    <p>
      A workspace is where your conversations, files and assistants are stored.
      You can have multiple workspaces and switch between quickly.
    </p>
    <SpaceOpener />
  </div>
</CenteredPage>
