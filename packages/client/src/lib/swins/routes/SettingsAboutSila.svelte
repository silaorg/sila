<script lang="ts">
  import { i18n } from "@sila/client";
  import SettingsSidebar from "./SettingsSidebar.svelte";
  import { BookOpenText, Globe, Mail, Github } from "lucide-svelte";
</script>

<div class="flex gap-4 w-full">
  <SettingsSidebar />

  <div class="flex-1 space-y-4">
    <p class="text-sm">
      {i18n.texts.wizards.freshStartDescription}
    </p>

    <div class="flex flex-wrap gap-2">
      <a
        class="btn preset-filled-primary-500"
        href="https://www.silain.com/"
        target="_blank"
        rel="noreferrer"
      >
        <Globe size={16} />
        {i18n.texts.settingsPage.aboutSila.websiteLinkLabel}
      </a>

      <a
        class="btn preset-tonal"
        href="https://www.silain.com/v1/features/"
        target="_blank"
        rel="noreferrer"
      >
        <BookOpenText size={16} />
        {i18n.texts.settingsPage.aboutSila.docsLinkLabel}
      </a>

      <a
        class="btn preset-tonal"
        href="https://github.com/silaorg/sila"
        target="_blank"
        rel="noreferrer"
      >
        <Github size={16} />
        GitHub
      </a>

      <a
        class="btn preset-tonal"
        href="mailto:hi@silain.com"
        target="_blank"
        rel="noreferrer"
      >
        <Mail size={16} />
        hi@silain.com
      </a>
    </div>
  </div>
</div>
