Fal model matrix for this land

Use this file when you need to choose an endpoint before calling `fal_run`.

Recommended defaults

- Text prompt to a still image: `fal-ai/nano-banana-pro`
- Edit one or more existing images: `fal-ai/nano-banana-pro/edit`
- Animate one image with best quality: `fal-ai/veo3.1/image-to-video`
- Animate one image faster and cheaper: `fal-ai/veo3.1/fast/image-to-video`
- Animate from first frame to last frame: `fal-ai/veo3.1/first-last-frame-to-video`
- Animate from several reference images: `fal-ai/veo3.1/reference-to-video`

Key input shapes

- `fal-ai/nano-banana-pro`
  - Required: `prompt`
  - Common options: `num_images`, `aspect_ratio`, `output_format`, `resolution`, `sync_mode`
  - Output: `images[].url`

- `fal-ai/nano-banana-pro/edit`
  - Required: `prompt`, `image_urls`
  - Common options: `num_images`, `aspect_ratio`, `output_format`, `resolution`, `sync_mode`
  - Output: `images[].url`

- `fal-ai/veo3.1/image-to-video`
  - Required: `prompt`, `image_url`
  - Common options: `aspect_ratio`, `duration`, `resolution`, `generate_audio`, `negative_prompt`
  - Output: `video.url`

- `fal-ai/veo3.1/fast/image-to-video`
  - Required: `prompt`, `image_url`
  - Common options: `aspect_ratio`, `duration`, `resolution`, `generate_audio`, `negative_prompt`
  - Output: `video.url`

- `fal-ai/veo3.1/first-last-frame-to-video`
  - Required: `prompt`, `first_frame_url`, `last_frame_url`
  - Common options: `aspect_ratio`, `duration`, `resolution`, `generate_audio`, `negative_prompt`
  - Output: `video.url`

- `fal-ai/veo3.1/reference-to-video`
  - Required: `prompt`, `image_urls`
  - Common options: `aspect_ratio`, `duration`, `resolution`, `generate_audio`
  - Output: `video.url`

Selection rules

- If the user only describes the desired final image, start with `fal-ai/nano-banana-pro`.
- If the user says "edit", "change", "remove", "replace", "keep the subject", or gives source images, start with `fal-ai/nano-banana-pro/edit`.
- If the user wants motion from one image, choose a Veo image-to-video variant.
- If the user explicitly wants a transition between two stills, choose `first-last-frame-to-video`.
- If the user cares about matching a subject or style across several references, choose `reference-to-video`.
- If the user wants quick iteration or lower cost, prefer the `fast` Veo variant.

Notes about Fal behavior

- Fal recommends queue-based execution for slower jobs. The land tool uses `fal.subscribe(...)` for that reason.
- Inputs that expect files can accept hosted URLs or base64 data URIs. In this land, prefer `upload_files` so the tool uploads local files through `fal.storage.upload(...)` and injects the resulting URLs into `input`.
- Sandbox uses canonical fields across models, but raw API calls need each endpoint's real field names. Do not assume all models share the same schema.

Official references checked on 2026-03-07

- [Fal docs index for LLMs](https://fal.ai/llms.txt)
- [Nano Banana Pro](https://fal.ai/models/fal-ai/nano-banana-pro/api)
- [Nano Banana Pro edit](https://fal.ai/models/fal-ai/nano-banana-pro/edit/api)
- [Veo 3.1 image-to-video](https://fal.ai/models/fal-ai/veo3.1/image-to-video/api)
- [Veo 3.1 fast image-to-video](https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video/api)
- [Veo 3.1 first-last-frame-to-video](https://fal.ai/models/fal-ai/veo3.1/first-last-frame-to-video/api)
- [Veo 3.1 reference-to-video](https://fal.ai/models/fal-ai/veo3.1/reference-to-video/api)
- [Sandbox canonical input notes](https://docs.fal.ai/model-apis/model-endpoints/sandbox)
