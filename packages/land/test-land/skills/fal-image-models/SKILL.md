---
name: fal-image-models
description: Use this when you need to choose a fal.ai image model or endpoint to fulfill an image generation or editing request. Activate it before calling Fal for tasks like text-to-image, image editing, typography-heavy output, product visuals, marketing assets, fast drafts, or enterprise-safe workflows.
---

What this skill is for
- Picking the right Fal image model for a user request.

When to use it
- The user asks to generate or edit an image with Fal and you need to pick the right model first.
- The user asks which Fal image model to use.
- The user wants a shortlist of Fal image models for a task.
- The user asks for tradeoffs between Fal image models.

How to work
1. Identify the task first. Common buckets are text-to-image, image editing, typography-heavy output, product or marketing assets, fast iteration, and enterprise-safe generation.
2. Use the model notes below as the first shortlist.
3. If the user asks for the latest model list, current pricing, or current quality claims, verify on official `fal.ai` pages before answering.
4. Recommend one primary endpoint and one fallback. Keep the explanation short and concrete.
5. Prefer endpoint ids in the answer so the recommendation can be used directly with Fal tooling.

Output shape
- Task
- Recommended endpoint
- Fallback endpoint
- Why this fits
- Caveats

Model shortlist

Verified against official Fal pages on 2026-03-07.

Quick picks
- Typography, diagrams, ad creatives, and text-heavy images: `fal-ai/nano-banana-pro`
- Fast photoreal or prompt-faithful text-to-image: `fal-ai/flux-pro/kontext/text-to-image`
- Reference-guided edits and controlled rewrites: `fal-ai/nano-banana-pro/edit` or `fal-ai/qwen-image-max/edit`
- Enterprise or licensed-data workflows: `bria/fibo/generate`

Model notes

| Endpoint | Task | Best for | Avoid when | Notes | Official page |
| --- | --- | --- | --- | --- | --- |
| `fal-ai/nano-banana-pro` | text-to-image | Marketing visuals, text rendering, layout-heavy compositions, character consistency | You only need the fastest cheap draft | Fal positions this as a premium image model with strong semantic understanding and typography. | [fal.ai/models/fal-ai/nano-banana-pro](https://fal.ai/models/fal-ai/nano-banana-pro) |
| `fal-ai/nano-banana-pro/edit` | image edit | High-quality edits to existing images, preserving structure while changing content | You need a basic low-cost edit pass | Good default for polished edit workflows when the source image matters. | [fal.ai/models/fal-ai/nano-banana-pro/edit](https://fal.ai/models/fal-ai/nano-banana-pro/edit) |
| `fal-ai/flux-pro/kontext/text-to-image` | text-to-image | Prompt following, realism, typography, product imagery | You need a model chosen for enterprise licensing constraints | Strong default for general high-quality generation. | [fal.ai/models/fal-ai/flux-pro/kontext/text-to-image](https://fal.ai/models/fal-ai/flux-pro/kontext/text-to-image) |
| `fal-ai/flux-pro/kontext` | image edit | Reference-image edits, local rewrites, keeping scene structure while changing details | You need an explicit premium enterprise workflow | Good fallback when the task is mostly edit or transform, not pure generation. | [fal.ai/models/fal-ai/flux-pro/kontext](https://fal.ai/models/fal-ai/flux-pro/kontext) |
| `fal-ai/qwen-image-2/text-to-image` | text-to-image | Typography-aware generation and design-heavy prompts | You need the most established photoreal default | Useful when text in image quality matters more than broad ecosystem familiarity. | [fal.ai/models/fal-ai/qwen-image-2/text-to-image](https://fal.ai/models/fal-ai/qwen-image-2/text-to-image) |
| `fal-ai/qwen-image-max/edit` | image edit | Precise edits, instruction-heavy image changes, typography-sensitive rewrites | You need a simpler or cheaper edit path | Good candidate when the prompt is detailed and edit accuracy matters. | [fal.ai/models/fal-ai/qwen-image-max/edit](https://fal.ai/models/fal-ai/qwen-image-max/edit) |
| `bria/fibo/generate` | text-to-image | Enterprise usage, brand-safe commercial work, controllable licensed-data workflows | You want the broadest community momentum or creative experimentation first | Fal presents this as an enterprise-oriented model family rather than a consumer-first default. | [fal.ai/models/bria/fibo/generate](https://fal.ai/models/bria/fibo/generate) |

How to recommend
- Start from the task, not the model family.
- Give one default and one fallback.
- Explain the tradeoff in one line each.
- If the user says `best` or `latest`, verify on `fal.ai` before giving a final pick.
