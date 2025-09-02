# Sila is free for anyone, for any use

It's fully open source, so the app is free. You can use it at work, school, or home. No restrictions.

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

### Example monthly costs (ballpark)

These are rough examples to help you plan. Actual prices vary by model and provider.

- Starter (casual use)
  - 10 chats/day × 30 days = 300 chats
  - ~700 tokens input + ~500 tokens output per chat = ~1,200 tokens/chat
  - Total tokens: ~360k tokens/month
  - If a model costs ~$5 per 1M input tokens and ~$15 per 1M output tokens, this lands around **$3–$6/month**

- Pro (daily deep work)
  - 30 chats/day × 30 days = 900 chats
  - ~2k tokens input + ~1k tokens output per chat = ~3k tokens/chat
  - Total tokens: ~2.7M tokens/month
  - With mid‑tier model pricing, expect roughly **$20–$60/month**

- Team (shared workspace)
  - 5 people × 30 chats/day × 30 days = 4,500 chats
  - ~2k input + ~1k output = ~3k tokens/chat
  - Total tokens: ~13.5M tokens/month
  - With efficient models and good prompts, expect roughly **$100–$300/month**

Tips to control cost:

- **Use the right model** for the task (cheaper models for simple asks).
- **Trim context** and files to what’s needed.
- **Prefer short replies** when you only need a summary.
- **Run locally** for private or frequent tasks (if your device allows it).

Sila shows the selected model per assistant and chat, so you can switch models quickly and keep costs predictable.