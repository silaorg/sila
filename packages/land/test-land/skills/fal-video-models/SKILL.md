---
name: fal-video-models
description: Use this when you need to choose a fal.ai video model or endpoint to fulfill a video generation request. Activate it before calling Fal for tasks like text-to-video, image-to-video, reference-to-video, cinematic output, fast drafts, first-frame control, subject consistency, or audio-enabled generation.
---

What this skill is for
- Picking the right Fal video model for a user request.

When to use it
- The user asks to generate a video with Fal and you need to pick the right model first.
- The user asks which Fal video model to use.
- The user wants a shortlist of Fal video models for a task.
- The user asks for tradeoffs between Fal video models.

How to work
1. Identify the task first. Common buckets are text-to-video, image-to-video, reference-to-video, high-end cinematic output, fast iteration, and audio-native generation.
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
- Highest-end general video quality with strong Google-model positioning: `fal-ai/veo3.1` or `fal-ai/veo3.1/image-to-video`
- Cinematic prompt-led video generation: `fal-ai/kling-video/v3/pro/text-to-video`
- Strong first-frame control from a supplied image: `fal-ai/pixverse/v5.5/image-to-video`
- Reference-driven consistency across shots or character work: `kling-video/o3/pro/reference-to-video`
- Open-weight style experimentation or multimodal expansion paths: `fal-ai/ltx-2-19b/image-to-video`

Model notes

| Endpoint | Task | Best for | Avoid when | Notes | Official page |
| --- | --- | --- | --- | --- | --- |
| `fal-ai/veo3.1` | text-to-video | Premium general video generation when quality matters more than speed | You need the cheapest or fastest iteration loop | Good flagship default when the user wants top-tier output and does not need a niche workflow. | [fal.ai/models/fal-ai/veo3.1](https://fal.ai/models/fal-ai/veo3.1) |
| `fal-ai/veo3.1/image-to-video` | image-to-video | High-end motion from a supplied first frame or source image | You need heavier style presets or creator-focused controls | Strong default for turning a still into polished motion. | [fal.ai/models/fal-ai/veo3.1/image-to-video](https://fal.ai/models/fal-ai/veo3.1/image-to-video) |
| `fal-ai/veo3.1/reference-to-video` | reference-to-video | Reference-aware generation where source guidance matters | You only need a quick simple image-to-video pass | Use when consistency to a reference matters more than raw experimentation. | [fal.ai/models/fal-ai/veo3.1/reference-to-video](https://fal.ai/models/fal-ai/veo3.1/reference-to-video) |
| `fal-ai/kling-video/v3/pro/text-to-video` | text-to-video | Cinematic prompt-led generation, stylized motion, creator-facing output | You need Google-model positioning or audio-native features first | Good fallback when the user wants a strong creative text-to-video model. | [fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video](https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video) |
| `fal-ai/kling-video/v3/pro/image-to-video` | image-to-video | Stylized image-to-video with strong cinematic feel | You need the most reference-faithful workflow | Useful for creative motion from a single image. | [fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video) |
| `kling-video/o3/pro/reference-to-video` | reference-to-video | Character consistency, multi-reference guidance, structured visual continuity | You only need a simple one-image animation | Good pick when the user explicitly cares about keeping a subject or style stable. | [fal.ai/models/kling-video/o3/pro/reference-to-video](https://fal.ai/models/kling-video/o3/pro/reference-to-video) |
| `fal-ai/pixverse/v5.5/image-to-video` | image-to-video | First-frame fidelity, aspect ratio flexibility, creator presets | You need the most premium flagship output regardless of controls | Often a practical choice for creator workflows that start from a still image. | [fal.ai/models/fal-ai/pixverse/v5.5/image-to-video](https://fal.ai/models/fal-ai/pixverse/v5.5/image-to-video) |
| `fal-ai/magi/image-to-video` | image-to-video | Prompt adherence, motion logic, narrative or physics-sensitive scenes | You want the most familiar mainstream default first | Good niche pick when the motion behavior itself is the hard part. | [fal.ai/models/fal-ai/magi/image-to-video](https://fal.ai/models/fal-ai/magi/image-to-video) |
| `fal-ai/ltx-2-19b/image-to-video` | image-to-video | Open-weight workflows, experimentation, and teams that want more transparent model choices | You want the safest default for premium polished client-facing delivery | Useful when the user values openness or downstream flexibility. | [fal.ai/models/fal-ai/ltx-2-19b/image-to-video](https://fal.ai/models/fal-ai/ltx-2-19b/image-to-video) |

How to recommend
- Start from the task, not the model family.
- Give one default and one fallback.
- Explain the tradeoff in one line each.
- If the user says `best` or `latest`, verify on `fal.ai` before giving a final pick.
