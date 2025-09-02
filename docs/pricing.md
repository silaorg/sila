# Sila is free for anyone, for any use

It's fully open source, so the app is free. You can use it at work or school. No restrictions.

## Price of using AI models

You pay providers for inference (the model’s compute). Sila does not add fees.

- **You bring your own keys**: OpenAI, Google, Anthropic, or your own server (OpenAI‑compatible APIs).
- **Pay as you go**: Providers bill for tokens (text), images, and audio minutes.
- **Local models**: With Ollama or similar, inference is free to use, but you pay with your hardware resources and electricity.

### How text pricing works

- **Tokens** are chunks of text (~3–4 characters per token on average).
- You pay for both **input tokens** (your prompt + context) and **output tokens** (the model’s reply).
- Providers publish prices, usually “$X per 1M tokens” for input and output separately.

Simple estimate:

- Short message: ~100–300 tokens
- Long prompt with files/context: 1k–8k+ tokens
- Model reply: ~200–1,000 tokens

To estimate cost for a message: `(input_tokens × input_rate) + (output_tokens × output_rate)`

### Images and audio

- Vision: You pay per image and/or per processed tokens depending on provider.
- Audio: You pay per minute for transcription or TTS.

### Example monthly costs (rough)

These examples help with planning. Actual prices vary by model and provider.

- Starter (casual)
  - 10 chats/day × 30 days = 300 chats
  - ~1,200 tokens/chat total
  - ≈ 360k tokens/month
  - Typical mid‑range models: **$1–$3/month**

- Pro (deep work)
  - 30 chats/day × 30 days = 900 chats
  - ~3k tokens/chat total
  - ≈ 2.7M tokens/month
  - Typical mid‑range models: **$10–$30/month**

- Team (5 people)
  - 5 × 30 chats/day × 30 days = 4,500 chats
  - ~3k tokens/chat total
  - ≈ 13.5M tokens/month
  - Typical mid‑range models: **$70–$200/month**

Assumptions: balanced input/output tokens, moderate context sizes, and mid‑range models.

Sila helps manage costs automatically (efficient defaults, smart context). You can always see the selected model per assistant and chat.