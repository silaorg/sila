---
name: fal-model-selection
description: Choose the right Fal endpoint and default input shape for image generation, image editing, and image-to-video work. Use when a user asks which Fal model to use, when multiple Fal endpoints could fit, or before building a fal_run call for Nano Banana Pro or Veo 3.1 workflows.
---

# Fal Model Selection

Read `references/model-matrix.md`.

Choose the narrowest endpoint that matches the user request.

- Use `fal-ai/nano-banana-pro` for text-to-image.
- Use `fal-ai/nano-banana-pro/edit` for editing one or more existing images.
- Use `fal-ai/veo3.1/image-to-video` when quality matters more than speed.
- Use `fal-ai/veo3.1/fast/image-to-video` for cheaper and faster drafts.
- Use `fal-ai/veo3.1/first-last-frame-to-video` when the user gives a starting frame and an ending frame.
- Use `fal-ai/veo3.1/reference-to-video` when the user gives multiple reference images for consistent subject appearance.

Prefer current official endpoint defaults instead of carrying old wrapper assumptions forward.

- Nano Banana Pro defaults to still images with `images[].url` output.
- Veo 3.1 variants return one `video.url`.
- Fal docs usually show the exact required input keys. Reuse those keys directly in `fal_run.input`.

After choosing the endpoint, read `../fal-tool-arguments/SKILL.md` if you still need help shaping the `fal_run` call.
