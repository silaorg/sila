<script lang="ts">
  type RouteInfo = {
    path: string;
    label: string;
    file: string;
  };

  const labelByPath: Record<string, string> = {
    "/app": "Open full app with CityBean demo space",
    "/components/chat": "ChatApp sandbox",
    "/components/chat/assistant-processing": "Chat: assistant processing",
    "/components/chat/assistant-tools-in-progress": "Chat: assistant tools in progress",
    "/components/chat/error": "Chat: error message",
    "/components/chat/scroll-test": "Chat: scroll test",
    "/components/freshStartWizard": "Fresh start wizard",
    "/components/markdown": "Markdown showcase",
    "/components/spaceSetupWizard": "Space setup wizard",
  };

  const pages = import.meta.glob("./**/+page.svelte", { eager: true });

  function fileToRoutePath(file: string): string {
    // "./components/chat/error/+page.svelte" -> "/components/chat/error"
    // "./+page.svelte" -> "/"
    // Normalize to a route-style path that always starts with "/"
    const withoutPrefix = file.replace(/^\.\//, "/");
    const withoutSuffix = withoutPrefix.replace(/\/\+page\.svelte$/, "");
    if (withoutSuffix === "") return "/";
    return withoutSuffix.startsWith("/") ? withoutSuffix : `/${withoutSuffix}`;
  }

  function normalize(s: string): string {
    return s.trim().toLowerCase();
  }

  const allRoutes: RouteInfo[] = Object.keys(pages)
    .map((file) => {
      const path = fileToRoutePath(file);
      return {
        path,
        file,
        label: labelByPath[path] ?? path,
      };
    })
    .filter((r) => r.path !== "/")
    .sort((a, b) => a.path.localeCompare(b.path));

  let filter = $state("");

  const filteredRoutes = $derived.by(() => {
    const f = normalize(filter);
    if (!f) return allRoutes;

    return allRoutes.filter((r) => {
      const hay = normalize(`${r.label} ${r.path}`);
      return hay.includes(f);
    });
  });

  type RouteNode = {
    key: string;
    segment: string;
    path: string;
    route?: RouteInfo;
    children: RouteNode[];
  };

  function buildTree(routes: RouteInfo[]): RouteNode {
    const root: RouteNode = { key: "", segment: "", path: "", children: [] };
    const byPath = new Map<string, RouteNode>([["", root]]);

    for (const r of routes) {
      const segments = r.path.split("/").filter(Boolean);
      let accPath = "";
      let parent = root;

      for (const seg of segments) {
        const nextPath = `${accPath}/${seg}`;
        let node = byPath.get(nextPath);
        if (!node) {
          node = { key: nextPath, segment: seg, path: nextPath, children: [] };
          byPath.set(nextPath, node);
          parent.children.push(node);
        }
        parent = node;
        accPath = nextPath;
      }

      parent.route = r;
    }

    const sortRec = (node: RouteNode) => {
      node.children.sort((a, b) => a.path.localeCompare(b.path));
      node.children.forEach(sortRec);
    };
    sortRec(root);

    return root;
  }

  function titleCase(s: string): string {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }

  function labelForNode(node: RouteNode): string {
    if (node.route?.label) return node.route.label;
    if (!node.segment) return "Routes";
    return titleCase(node.segment.replace(/[-_]/g, " "));
  }

  const routeTree = $derived(buildTree(filteredRoutes));
</script>

<div class="mx-auto max-w-4xl px-4 py-8 space-y-6">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <h1 class="h1 m-0">Sila Workbench</h1>
    <input
      class="flex-none w-[300px] rounded-md border border-surface-200-800 bg-surface-50-950 px-2 py-1 text-xs text-surface-900-50"
      placeholder="Search…"
      bind:value={filter}
    />
  </div>

  {#if filteredRoutes.length === 0}
    <div class="rounded-md border border-surface-200-800 bg-surface-50-950 p-4 text-sm text-surface-700-300">
      No routes match “{filter}”.
    </div>
  {:else}
    <div class="space-y-3">
      {#snippet renderNode(node: RouteNode, depth: number)}
        {#if node.path !== ""}<!-- skip artificial root -->
          {#if node.route}
            <div class="space-y-1" style={`padding-left: ${depth * 14}px`}>
              <a class="anchor font-medium" href={node.path}>
                {labelForNode(node)}
              </a>
              <div class="text-[11px] text-surface-600-400 font-mono opacity-70">
                {node.path}
              </div>
            </div>
          {:else}
            <div
              class="text-xs font-semibold text-surface-700-300"
              style={`padding-left: ${depth * 14}px`}
            >
              {labelForNode(node)}
            </div>
          {/if}
        {/if}

        {#if node.children.length > 0}
          <div class="space-y-2">
            {#each node.children as child (child.key)}
              {@render renderNode(child, node.path === "" ? 0 : depth + 1)}
            {/each}
          </div>
        {/if}
      {/snippet}

      <div class="rounded-xl border border-surface-200-800 bg-surface-50-950 p-4 space-y-2">
        {#each routeTree.children as child (child.key)}
          {@render renderNode(child, 0)}
        {/each}
      </div>
    </div>
  {/if}
</div>

