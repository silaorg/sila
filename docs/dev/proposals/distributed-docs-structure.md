# Distributed Documentation Structure Proposal

## Proposed Solution

Use a distributed structure where each folder contains an `index.json` file that defines metadata for that folder and its contents.

## Structure Overview

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

## Zod Schema (Validation)

```ts
import { z } from "zod";

export const DocItemTypeSchema = z.enum(["section", "page"]);

export const DocItemSchema = z.object({
  name: z.string().min(1),
  type: DocItemTypeSchema,
  label: z.string().min(1),
  collapsed: z.boolean().optional(),
  url: z.string().url().optional() // for potential external links
});

export const IndexSchema = z.object({
  items: z.array(DocItemSchema)
});

export type DocItem = z.infer<typeof DocItemSchema>;
export type IndexFile = z.infer<typeof IndexSchema>;
```

## Benefits

### For Maintainers
- **Local context**: Each folder's structure is defined where the content lives
- **Easier navigation**: Contributors can see folder structure immediately
- **Reduced conflicts**: Changes to different sections don't conflict
- **Clear ownership**: Each team can manage their own section

### For Contributors
- **Intuitive**: Add a file, update the local `index.json`
- **Self-contained**: All metadata for a section in one place
- **Discoverable**: Easy to see what's in each folder
- **Flexible**: Can add metadata like descriptions, order, icons

### For Build System
- **Incremental**: Only rebuild sections that changed
- **Cached**: Can cache parsed index files
- **Validated**: Can validate structure at build time
- **Generated**: Could auto-generate missing index files

## Implementation Strategy

### Phase 1: Prototype
1. Create `.index.json` files in one section (e.g., `dev/for-ai/`)
2. Build simple parser for distributed structure
3. Create Zod schema for validation
4. Test with existing documentation

### Phase 2: Rollout
1. Create `.index.json` files in all sections
2. Update build system to read distributed structure
3. Add validation for all index files
4. Remove centralized structure

### Phase 3: Enhancement
1. Add metadata like descriptions, icons, order
2. Support for external links
3. Search integration
4. Breadcrumb generation

## Decisions

- **Validation**: Yes — validate all `.index.json` files with Zod
- **Performance**: Not a focus yet
- **Search**: Out of scope (handled separately)

## Next Steps

1. Create prototype with one section (e.g., `dev/for-ai/`)
2. Build simple parser for distributed structure
3. Compare output with current centralized approach
4. Gather feedback on format and usability
5. Plan full migration strategy
