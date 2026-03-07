---
name: fal-tool-arguments
description: Build correct `fal_run` tool calls for this land. Use when a task needs Fal input shaping, local file upload mapping, explicit output_paths, or output file naming for image and video jobs.
---

# Fal Tool Arguments

Read `references/fal-run-shape.md`.

Use the land-local `fal_run` tool with these rules.

- Put the real endpoint schema into `input`. Do not rename fields to match older wrappers.
- Use `upload_files` for local assets and inject them into `input` with `input_path`.
- Use `output_paths` when the result shape is not obvious or when you only want a subset of outputs saved.
- Use `output_path` to control where generated files land. If several outputs are expected, pass an extensionless base path and let the tool append `-1`, `-2`, and the detected extension.

Prefer these upload path patterns.

- `image_url` for one source image
- `image_urls[0]`, `image_urls[1]` for multiple source images
- `first_frame_url` and `last_frame_url` for first/last-frame video generation

If endpoint selection is still unclear, read `../fal-model-selection/SKILL.md`.
