# Sila Demo Space Builder

A tool for building demo spaces from JSON configuration files. Creates complete Sila spaces with assistants, providers, and conversations that can be opened directly in Sila.

## Usage

```bash
# Use default configuration
npm run build-demo-space

# Use custom JSON file
npm run build-demo-space my-demo.json

# Use custom output directory
npm run build-demo-space -- --output ./my-demo

# Use custom JSON and output
npm run build-demo-space my-demo.json --output ./my-demo
```

## JSON Configuration Format

```json
{
  "type": "sila-space",
  "version": "1",
  "name": "Demo Space Name",
  "createdAt": "2025-08-05T07:00:00.000Z",
  "description": "Optional description",
  "assistants": [
    {
      "id": "chat",
      "name": "Chat",
      "button": "New query",
      "visible": true,
      "description": "A basic chat assistant",
      "instructions": "You are Sila, an AI assistant. Be direct in all responses.",
      "targetLLM": "openai/gpt-4"
    }
  ],
  "providers": [
    {
      "id": "openai",
      "apiKey": "sk-your-api-key"
    }
  ],
  "conversations": [
    {
      "title": "Welcome to Sila",
      "assistant": "chat",
      "messages": {
        "role": "user",
        "text": "Hello! Can you help me get started with Sila?",
        "createdAt": "2025-08-05T07:00:00.000Z",
        "main": true,
        "children": [
          {
            "role": "assistant",
            "text": "Welcome to Sila! I'm here to help you get started...",
            "createdAt": "2025-08-05T07:00:00.000Z",
            "main": true
          }
        ]
      }
    }
  ]
}
```

### Configuration Fields

- **`type`**: Must be `"sila-space"`
- **`version`**: Format version (currently `"1"`)
- **`name`**: Display name for the space
- **`createdAt`**: ISO date string for space creation time
- **`description`**: Optional description
- **`assistants`**: Array of assistant configurations
- **`providers`**: Array of model provider configurations
- **`conversations`**: Array of conversation configurations

### Assistant Configuration

- **`id`**: Unique identifier for the assistant
- **`name`**: Display name
- **`button`**: Button text for new conversations
- **`visible`**: Whether the assistant is visible (default: true)
- **`description`**: Assistant description
- **`instructions`**: System prompt/instructions
- **`targetLLM`**: Optional target model (e.g., "openai/gpt-4o")

### Provider Configuration

- **`id`**: Provider identifier (e.g., "openai", "anthropic")
- **`apiKey`**: API key for the provider

### Conversation Configuration

- **`title`**: Conversation title
- **`assistant`**: Assistant ID to use for this conversation
- **`messages`**: Tree structure of messages with branching support

### Message Structure

Messages support a tree structure for branching conversations:

- **`role`**: "user" or "assistant"
- **`text`**: Message content
- **`createdAt`**: ISO date string
- **`main`**: Whether this is the main branch (default: true)
- **`children`**: Array of child messages for branching

## Examples

See `examples/getting-started.json` for a complete working example.

## Safety Features

- Only cleans directories containing space-related content
- Protects against accidentally overwriting important files
- Ignores hidden files (`.gitignore`, `.DS_Store`, etc.)
- Clear error messages for invalid configurations
