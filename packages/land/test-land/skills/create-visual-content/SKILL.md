---
name: create-visual-content
description: Create or edit visual content in this land, including still images and videos, without exposing provider-specific details to the user. Use when the user wants an image generated, an image edited, a still turned into a video, or when you need the exact `fal_run` payload shape for a visual content task.
---

# Create Visual Content

Use this skill when the user asks for visual content work.

- Generate an image from a prompt.
- Edit or transform an existing image.
- Turn an image into a video.
- Turn first and last frames into a video.
- Prepare a correct `fal_run` call for any of the above.

Workflow
- If the task is a still image or image edit, use `fal-image-models` first to choose the endpoint.
- If the task is video or animation, use `fal-video-models` first to choose the endpoint.
- Then build the exact `fal_run` call.
- Keep provider detail out of the user-facing answer unless the user asks for it.

fal_run shape
- `endpoint`: exact Fal endpoint id
- `input`: exact endpoint JSON payload
- `upload_files` (optional): list of local files to upload and inject into `input`
- `output_paths` (recommended): JSON paths to URL fields you want downloaded
- `output_path` (recommended): output file path or base path
- `storage_lifecycle` (optional): retention hint for uploaded or generated files

Core rules
- Always pass input as a JSON object. Calls without input will fail.
- Put the real endpoint schema into `input`. Do not rename fields to match older wrappers.
- Prefer explicit output_paths (so you save the exact file you want).
- Prefer explicit output_path (so outputs land in a predictable place).
- Do not pass local file paths inside input. Upload them via upload_files and inject URLs into input with input_path.
- The tool uses `fal.subscribe(...)`, not `fal.run(...)`, because queue execution is the safer default for slower jobs.

Common endpoints
- Text to image: fal-ai/nano-banana-pro
- Edit images: fal-ai/nano-banana-pro/edit
- Image to video (quality): fal-ai/veo3.1/image-to-video
- Image to video (fast draft): fal-ai/veo3.1/fast/image-to-video
- First+last frame to video: fal-ai/veo3.1/first-last-frame-to-video
- Multiple reference images to video: fal-ai/veo3.1/reference-to-video

Typical outputs
- Nano Banana Pro returns images under: images[0].url
- Veo 3.1 variants return video under: video.url

Prefer these upload path patterns
- image_url for one source image
- image_urls[0], image_urls[1] for multiple source images
- first_frame_url and last_frame_url for first/last-frame video generation

Examples

1) Text to image
{
  "endpoint": "fal-ai/nano-banana-pro",
  "input": {
    "prompt": "Minimal flat blue genie mascot rising from a lamp on white background",
    "num_images": 1,
    "aspect_ratio": "1:1",
    "output_format": "png",
    "resolution": "1K"
  },
  "output_paths": ["images[0].url"],
  "output_path": "assets/genie"
}

2) Edit a local image
{
  "endpoint": "fal-ai/nano-banana-pro/edit",
  "input": {
    "prompt": "Remove the background and add a soft studio shadow",
    "image_urls": [null],
    "output_format": "png",
    "resolution": "1K"
  },
  "upload_files": [
    { "path": "assets/source.png", "input_path": "image_urls[0]" }
  ],
  "output_paths": ["images[0].url"],
  "output_path": "assets/source-cutout"
}

3) Image to video
{
  "endpoint": "fal-ai/veo3.1/image-to-video",
  "input": {
    "prompt": "Camera slowly pushes in, natural motion",
    "image_url": null,
    "duration": "8s",
    "resolution": "720p",
    "generate_audio": true
  },
  "upload_files": [
    { "path": "assets/portrait.jpg", "input_path": "image_url" }
  ],
  "output_paths": ["video.url"],
  "output_path": "assets/portrait-motion"
}

Common mistakes to avoid
- Do not pass local file paths inside input. Upload them first.
- Do not assume every endpoint uses image_urls; some need image_url, first_frame_url, or last_frame_url.
- Do not assume all outputs are images. Veo returns video.url.
- Do not assume Sandbox field names match raw API schemas for every model.
- If model choice is unclear, use `fal-image-models` for stills and edits, or `fal-video-models` for motion.

Official references checked on 2026-03-07
- [Fal docs index for LLMs](https://fal.ai/llms.txt)
- [JavaScript client overview](https://docs.fal.ai/reference/client-libraries/javascript/index)
- [Queue API](https://docs.fal.ai/model-endpoints/queue)
- [Synchronous requests](https://docs.fal.ai/model-endpoints/synchronous-requests)
- [Client guide with uploads](https://docs.fal.ai/model-apis/client)
