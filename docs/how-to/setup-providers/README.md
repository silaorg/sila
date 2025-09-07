# How to setup AI model providers

Here's the the most unpleasant or complicated part about Sila. Sila doesn't have its own build-in AI model ([because](../../features/local-first.md)), instead - it uses whatever models available. You need to add at least one model provider to use Sila. We recommend to setup [OpenRouter](./openrouter.md) as it's currently the easist thing because it allows to use most of the most capable models. You register an account there and then create a key (kind of like a big unique password for apps) and then insert that password in Sila.

The whole list:
- [OpenRouter](./openrouter.md) (recommended first)
- [OpenAI](./openai.md)
@TODO: add others