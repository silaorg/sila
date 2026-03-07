`fal_run` call shape for this land

Tool contract

- `endpoint`: Fal endpoint id. The tool only accepts `fal-ai/...` ids.
- `input`: Exact endpoint JSON payload.
- `upload_files`: Optional list of local files to upload before running the endpoint.
- `output_path`: Optional output file path or base path.
- `output_paths`: Optional JSON paths to URLs in `result.data`, with raw result fallback.
- `storage_lifecycle`: Optional retention hint passed to Fal for uploaded and generated files.

Environment

- The tool injects Fal credentials automatically from `FAL_AI_API_KEY` or `FAL_KEY` in process env, with fallback to the land `.env`.
- The tool calls `fal.subscribe(...)`, not `fal.run(...)`, because Fal recommends the queue flow for slower jobs.

Argument rules

- Keep `input` as close to the official endpoint schema as possible.
- Inject uploaded file URLs into `input` with `upload_files[].input_path`.
- Prefer explicit `output_paths` in examples even though the tool auto-detects common `url` fields.
- Save outputs under the thread cwd unless `output_path` is provided.

Examples

Text to image with Nano Banana Pro

```json
{
  "endpoint": "fal-ai/nano-banana-pro",
  "input": {
    "prompt": "Studio product photo of a ceramic coffee mug on warm travertine",
    "num_images": 1,
    "aspect_ratio": "1:1",
    "output_format": "png",
    "resolution": "1K"
  },
  "output_paths": ["images[0].url"],
  "output_path": "workspace/mug"
}
```

Edit one local image

```json
{
  "endpoint": "fal-ai/nano-banana-pro/edit",
  "input": {
    "prompt": "Remove the background and add a soft studio shadow",
    "image_urls": [null],
    "output_format": "png",
    "resolution": "1K"
  },
  "upload_files": [
    {
      "path": "assets/source.png",
      "input_path": "image_urls[0]"
    }
  ],
  "output_paths": ["images[0].url"],
  "output_path": "workspace/source-cutout"
}
```

Animate one local image into a video

```json
{
  "endpoint": "fal-ai/veo3.1/image-to-video",
  "input": {
    "prompt": "The camera slowly pushes in while the subject smiles and blinks naturally",
    "image_url": null,
    "duration": "8s",
    "resolution": "720p",
    "generate_audio": true
  },
  "upload_files": [
    {
      "path": "assets/portrait.jpg",
      "input_path": "image_url"
    }
  ],
  "output_paths": ["video.url"],
  "output_path": "workspace/portrait-motion"
}
```

Animate from first and last frames

```json
{
  "endpoint": "fal-ai/veo3.1/first-last-frame-to-video",
  "input": {
    "prompt": "Transition from a calm sunrise to a bright busy morning commute",
    "first_frame_url": null,
    "last_frame_url": null,
    "duration": "8s",
    "resolution": "720p"
  },
  "upload_files": [
    {
      "path": "assets/start.jpg",
      "input_path": "first_frame_url"
    },
    {
      "path": "assets/end.jpg",
      "input_path": "last_frame_url"
    }
  ],
  "output_paths": ["video.url"],
  "output_path": "workspace/sunrise-transition"
}
```

Common mistakes to avoid

- Do not pass local file paths inside `input`. Upload them first.
- Do not assume every endpoint uses `image_urls`; some need `image_url`, `first_frame_url`, or `last_frame_url`.
- Do not assume all outputs are images. Veo returns `video.url`.
- Do not assume Sandbox field names match raw API schemas for every model.

Official references checked on 2026-03-07

- [Fal docs index for LLMs](https://fal.ai/llms.txt)
- [JavaScript client overview](https://docs.fal.ai/reference/client-libraries/javascript/index)
- [Queue API](https://docs.fal.ai/model-endpoints/queue)
- [Synchronous requests](https://docs.fal.ai/model-endpoints/synchronous-requests)
- [Client guide with uploads](https://docs.fal.ai/model-apis/client)
