# How to estimate AI inference costs

When using Sila, you pay AI providers directly for inference (the model's compute). Sila adds no fees.

## How pricing works

- **You bring your own keys**: OpenAI, Google, Anthropic, or your own server (OpenAI‑compatible APIs).
- **Pay as you go**: Providers bill for tokens (text), images, and audio minutes.
- **Local models**: With Ollama or similar, inference is free to use, but you pay with your hardware resources and electricity.

## Text pricing explained

- **Tokens** are chunks of text (~3–4 characters per token on average).
- You pay for both **input tokens** (your prompt + context) and **output tokens** (the model's reply).
- Providers publish prices, usually "$X per 1M tokens" for input and output separately.

### Simple estimate

- Short message: ~100–300 tokens
- Long prompt with files/context: 1k–8k+ tokens
- Model reply: ~200–1,000 tokens

To estimate cost for a message: `(input_tokens × input_rate) + (output_tokens × output_rate)`

## Images and audio

- Vision: You pay per image and/or per processed tokens depending on provider.
- Audio: You pay per minute for transcription or TTS.

## Example monthly costs with GPT-5.2

These examples use GPT-5.2 pricing: $1.75 per 1M input tokens, $14.00 per 1M output tokens.

- Starter (casual)
  - 10 chats/day × 30 days = 300 chats
  - ~1,200 tokens/chat total
  - ≈ 360k tokens/month
  - Input: ~180k × $1.75 = **$0.32**
  - Output: ~180k × $14.00 = **$2.52**
  - **Total: ~$3/month**

- Pro (deep work)
  - 30 chats/day × 30 days = 900 chats
  - ~3k tokens/chat total
  - ≈ 2.7M tokens/month
  - Input: ~1.35M × $1.75 = **$2.36**
  - Output: ~1.35M × $14.00 = **$18.90**
  - **Total: ~$21/month**

- Team (5 people)
  - 5 × 30 chats/day × 30 days = 4,500 chats
  - ~3k tokens/chat total
  - ≈ 13.5M tokens/month
  - Input: ~6.75M × $1.75 = **$11.81**
  - Output: ~6.75M × $14.00 = **$94.50**
  - **Total: ~$106/month**