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

## Example monthly costs with GPT-5

These examples use GPT-5 pricing: $1.25 per 1M input tokens, $10.00 per 1M output tokens.

- Starter (casual)
  - 10 chats/day × 30 days = 300 chats
  - ~1,200 tokens/chat total
  - ≈ 360k tokens/month
  - Input: ~180k × $1.25 = **$0.23**
  - Output: ~180k × $10.00 = **$1.80**
  - **Total: ~$2/month**

- Pro (deep work)
  - 30 chats/day × 30 days = 900 chats
  - ~3k tokens/chat total
  - ≈ 2.7M tokens/month
  - Input: ~1.35M × $1.25 = **$1.69**
  - Output: ~1.35M × $10.00 = **$13.50**
  - **Total: ~$15/month**

- Team (5 people)
  - 5 × 30 chats/day × 30 days = 4,500 chats
  - ~3k tokens/chat total
  - ≈ 13.5M tokens/month
  - Input: ~6.75M × $1.25 = **$8.44**
  - Output: ~6.75M × $10.00 = **$67.50**
  - **Total: ~$76/month**

Assumptions: balanced input/output tokens, moderate context sizes, using GPT-5 pricing.

## Cost management

Sila helps manage costs automatically with efficient defaults and smart context management. You can always see the selected model per assistant and chat to track usage.
