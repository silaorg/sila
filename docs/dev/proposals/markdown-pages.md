# Distributed Markdown Pages System

## Overview

A system for building and rendering markdown-based content with distributed navigation structure. Each folder contains a `.index.json` file that defines metadata for that folder and its contents, replacing centralized navigation files.

This system can be used for any markdown-based content:
- **Documentation** (user guides, API docs, tutorials)
- **Blogs** (articles, posts, series)
- **Knowledge bases** (wikis, FAQs, help centers)
- **Guides** (how-to guides, manuals, references)
- **Any structured markdown content** that needs navigation

The system is designed to be:
- **Reusable** across different projects and content types
- **Scalable** as content grows
- **Maintainable** with local context for each section
- **Flexible** for different rendering contexts (app, website, static site)

## Structure

```
docs/
├── .index.json                   # Root metadata
├── product/
│   ├── .index.json              # Product section metadata
│   ├── features/
│   │   ├── .index.json          # Features section metadata
│   │   ├── workspaces.md
│   │   ├── assistants.md
│   │   └── chat.md
│   └── how-to/
│       ├── .index.json          # How-to section metadata
│       ├── setup-providers.md
│       └── sync.md
└── dev/
    ├── .index.json              # Dev section metadata
    ├── quick-start.md
    ├── for-ai/
    │   ├── .index.json          # For AI section metadata
    │   ├── rules.md
    │   └── svelte.md
    └── proposals/
        ├── .index.json          # Proposals section metadata
        └── distributed-docs-structure.md
```

## Index.json Format

### Root Level (`docs/.index.json`)
```json
{
  "items": [
    { "name": "product", "type": "section", "label": "Product" },
    { "name": "dev", "type": "section", "label": "Developers" }
  ]
}
```

### Section Level (`docs/product/.index.json`)
```json
{
  "items": [
    { "name": "features", "type": "section", "label": "Features" },
    { "name": "how-to", "type": "section", "label": "How To" },
    { "name": "pricing", "type": "page", "label": "Pricing" }
  ]
}
```

### Content Level (`docs/product/features/.index.json`)
```json
{
  "items": [
    { "name": "workspaces", "type": "page", "label": "Workspaces" },
    { "name": "assistants", "type": "page", "label": "Assistants" },
    { "name": "chat", "type": "page", "label": "Chat" }
  ]
}
```

## Zod Schema

```ts
import { z } from "zod";

export const DocItemTypeSchema = z.enum(["section", "page"]);

export const DocItemSchema = z.object({
  name: z.string().min(1),
  type: DocItemTypeSchema,
  label: z.string().min(1),
  collapsed: z.boolean().optional(),
  url: z.string().url().optional()
});

export const IndexSchema = z.object({
  items: z.array(DocItemSchema)
});

export type DocItem = z.infer<typeof DocItemSchema>;
export type IndexFile = z.infer<typeof IndexSchema>;
```

## Benefits

- **Local context**: Each folder's structure is defined where the content lives
- **Easier navigation**: Contributors can see folder structure immediately
- **Reduced conflicts**: Changes to different sections don't conflict
- **Intuitive**: Add a file, update the local `.index.json`
- **Type-safe**: Validate all `.index.json` files with Zod

## Implementation: Build-Time Generation

Generate navigation data at build time for both app and website.

### Build Script

```ts
// scripts/build-docs.ts
import { buildNavigationTree } from './parser';
import { readFileSync, writeFileSync } from 'fs';

// Generate navigation
const navigationTree = buildNavigationTree('docs');

// Bundle markdown content for app
const markdownBundle: Record<string, string> = {};

function bundleMarkdownFiles(tree: NavigationTree, basePath: string) {
  for (const item of tree.items) {
    if (item.type === 'page') {
      const filePath = `${basePath}/${item.path}`;
      const content = readFileSync(filePath, 'utf-8');
      markdownBundle[item.path] = content;
    } else if (item.items) {
      bundleMarkdownFiles(item, basePath);
    }
  }
}

bundleMarkdownFiles(navigationTree, 'docs');

// Write files
writeFileSync('packages/client/src/lib/docs/navigation.json', JSON.stringify(navigationTree, null, 2));
writeFileSync('packages/client/src/lib/docs/content.json', JSON.stringify(markdownBundle, null, 2));
writeFileSync('packages/website/src/lib/docs/navigation.json', JSON.stringify(navigationTree, null, 2));
```

### App Integration

```svelte
<!-- packages/client/src/lib/comps/docs/DocsPopover.svelte -->
<script lang="ts">
  import { NavigationTree, loadContent } from '@sila/markdown-pages/renderer';
  import { DocsSidebar, DocsContent } from '@sila/markdown-pages/renderer/components';
  import navigationData from '$lib/docs/navigation.json';
  
  let navigation = $state(new NavigationTree(navigationData));
  let currentPage = $state<string | null>(null);
  let pageContent = $state<string | null>(null);
  
  $effect(() => {
    if (currentPage) {
      loadContent(currentPage).then(content => {
        pageContent = content;
      });
    }
  });
</script>

<div class="docs-popover">
  <DocsSidebar {navigation} bind:currentPage />
  <DocsContent {pageContent} />
</div>
```

### Website Integration

```svelte
<!-- packages/website/src/routes/docs/[...slug]/+page.svelte -->
<script lang="ts">
  import { NavigationTree } from '@sila/markdown-pages/renderer';
  import { DocsSidebar, DocsContent } from '@sila/markdown-pages/renderer/components';
  import navigationData from '$lib/docs/navigation.json';
  
  export let data;
  let { content, slug } = data;
  
  let navigation = $state(new NavigationTree(navigationData));
</script>

<div class="docs-layout">
  <DocsSidebar {navigation} currentPage={slug} />
  <DocsContent {content} />
</div>
```

## Static Site Generation

Generate static HTML pages for deployment.

```ts
// scripts/build-static-docs.ts
import { buildNavigationTree } from './parser';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { marked } from 'marked';
import { join, dirname } from 'path';

function buildStaticSite() {
  const navigationTree = buildNavigationTree('docs');
  const pages = generateStaticPages(navigationTree, 'docs');
  const outputDir = 'dist/docs';
  
  mkdirSync(outputDir, { recursive: true });
  
  for (const page of pages) {
    const html = generateHTML(page);
    const outputPath = join(outputDir, page.path);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, html);
  }
  
  console.log(`Generated ${pages.length} static pages in ${outputDir}`);
}

buildStaticSite();
```

### Package.json Scripts

```json
{
  "scripts": {
    "build-docs": "tsx scripts/build-docs.ts",
    "build-static-docs": "tsx scripts/build-static-docs.ts",
    "build-all": "npm run build-docs && npm run build-static-docs"
  }
}
```

## Outputs

One build process generates three outputs:
1. **App**: `navigation.json` + `content.json` for Svelte popover (offline)
2. **Website**: `navigation.json` for SvelteKit dynamic routes
3. **Static**: Complete static HTML site for deployment

## Package Structure

### markdown-pages Package

Create a dedicated package for building and rendering markdown-based documentation with two main concerns: building and rendering.

```
packages/markdown-pages/
├── package.json
├── src/
│   ├── index.ts                 # Main exports
│   ├── types.ts                 # Shared types and Zod schemas
│   ├── builder/                 # Build-time functionality
│   │   ├── index.ts
│   │   ├── parser.ts            # Parse .index.json files
│   │   ├── builder.ts           # Build navigation and content
│   │   └── static-generator.ts  # Generate static HTML
│   ├── renderer/                # Runtime functionality
│   │   ├── index.ts
│   │   ├── navigation.ts        # Navigation tree processing
│   │   ├── content.ts           # Content loading and processing
│   │   └── components.ts        # Shared Svelte components
│   └── utils.ts                 # Utility functions
├── scripts/
│   ├── build-docs.ts            # CLI for building docs
│   └── build-static.ts          # CLI for static generation
└── README.md
```

### Package.json

```json
{
  "name": "@sila/markdown-pages",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "build-docs": "tsx scripts/build-docs.ts",
    "build-static": "tsx scripts/build-static.ts"
  },
  "dependencies": {
    "zod": "^3.22.0",
    "marked": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  },
  "bin": {
    "sila-markdown-pages": "./dist/scripts/build-docs.js"
  }
}
```

### Usage

**Build-time (CLI/scripts):**
```ts
import { buildDocs, generateStaticSite } from '@sila/markdown-pages/builder';

// Build for app and website
await buildDocs('docs', {
  appOutput: 'packages/client/src/lib/docs',
  websiteOutput: 'packages/website/src/lib/docs'
});

// Generate static site
await generateStaticSite('docs', 'dist/docs');
```

**Runtime (app/website):**
```ts
import { NavigationTree, loadContent } from '@sila/markdown-pages/renderer';
import { DocsSidebar, DocsContent } from '@sila/markdown-pages/renderer/components';

// Load navigation and content
const navigation = new NavigationTree(navigationData);
const content = await loadContent(pagePath);
```

**CLI:**
```bash
# Build docs
npx @sila/markdown-pages build-docs

# Generate static site
npx @sila/markdown-pages build-static

# Or use the binary
npx sila-markdown-pages
```

### Integration with Root Package.json

```json
{
  "scripts": {
    "build-docs": "npm -w packages/markdown-pages run build-docs",
    "build-static-docs": "npm -w packages/markdown-pages run build-static",
    "build-all": "npm run build-docs && npm run build-static-docs"
  }
}
```

## Next Steps

1. Create `packages/markdown-pages` package
2. Implement parser with Zod validation
3. Create build scripts and CLI
4. Implement shared Svelte components
5. Test with existing documentation
