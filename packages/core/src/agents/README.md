# Sila Agents

This directory contains the agent implementations for Sila.

## Agents Overview

### SimpleChatAgent
The original chat agent that provides basic conversation capabilities with AI models.

### ChatAgent (New)
A new agentic chat agent that can execute functions in a loop, allowing the AI to decide when to call tools and continue until no more tool calls are needed.

## ChatAgent Features

The `ChatAgent` extends the base `Agent` class and provides:

### Agentic Loop
- **Function Calling Loop**: The AI can call tools in a loop until it determines the task is complete
- **Maximum Steps**: Limited to 12 steps to prevent infinite loops
- **Tool Validation**: All tool calls are validated using Zod schemas
- **Error Handling**: Graceful error handling for tool execution failures

### Available Tools

#### read_url
- **Purpose**: Read content from web pages
- **Parameters**: 
  - `url` (string, required): Valid URL to read from
- **Returns**: Page content, title, and status
- **Note**: Currently returns dummy data for demonstration

#### web_search
- **Purpose**: Search the web for information
- **Parameters**:
  - `query` (string, required): Search query (minimum 3 characters)
  - `max_results` (number, optional): Maximum number of results (1-10, default 5)
- **Returns**: Search results with titles, URLs, and snippets
- **Note**: Currently returns dummy data for demonstration

#### finish
- **Purpose**: Signal task completion and provide final summary
- **Parameters**:
  - `summary` (string, required): Final summary of the task
  - `files_created` (string[], optional): List of files created during the task
- **Returns**: Confirmation of task completion

### Usage

#### Basic Usage
```typescript
import { ChatAgent, AgentServices } from '@sila/core';

// Create agent services
const agentServices = new AgentServices(space);

// Create agent configuration
const config = {
  id: 'my-agent',
  name: 'My Agentic Agent',
  button: 'Agent',
  description: 'An agent that can use tools',
  instructions: 'You are a helpful assistant with access to tools...',
  targetLLM: 'openai/gpt-4o'
};

// Create the agent
const agent = new ChatAgent(agentServices, config);
```

#### With Custom Tools Injection
```typescript
import { ChatAgent, AgentServices } from '@sila/core';
import { z } from 'zod';

// Define custom tools
const customTools = {
  get_random_number: {
    description: "Get a random number for testing purposes.",
    schema: z.object({}).strict(),
    impl: async () => ({ number: 6931 })
  },
  calculate_sum: {
    description: "Calculate the sum of two numbers.",
    schema: z.object({
      a: z.number(),
      b: z.number()
    }),
    impl: async ({ a, b }) => ({ result: a + b })
  }
};

// Create the agent with custom tools
const agent = new ChatAgent(agentServices, config, customTools);
```

// Use the agent
const messages = [
  {
    id: '1',
    role: 'user',
    text: 'Search for the latest news about AI and summarize it',
    inProgress: false,
    createdAt: Date.now(),
    updatedAt: null
  }
];

const response = await agent.input(messages, (stream) => {
  // Handle streaming updates
  console.log('Stream:', stream.text);
});

console.log('Final response:', response.text);
```

### System Prompt

The agent automatically adds tool instructions to the system prompt:

```
You are an AI assistant with access to tools that can help you gather information and complete tasks.

Available tools:
- read_url: Read content from web pages
- web_search: Search the web for information
- finish: Signal task completion

Use these tools when needed to provide accurate and up-to-date information. 
When you have completed the user's request, use the finish tool to provide a final summary.
```

### Implementation Details

#### Tool Schema Validation
All tools use Zod schemas for parameter validation:

```typescript
const tools = {
  read_url: {
    description: "Read content from a URL and return the text content.",
    schema: z.object({
      url: z.string().url("Must be a valid URL")
    }),
    impl: async ({ url }) => { /* implementation */ }
  }
};
```

#### Agentic Loop Flow
1. Initialize conversation with system prompt and user messages
2. Call AI model with available tools
3. If tools are requested:
   - Execute each tool with validated parameters
   - Add tool results to conversation
   - Continue loop until no more tools or finish is called
4. Return final response

#### Error Handling
- Tool validation errors are caught and returned as error messages
- Maximum step limit prevents infinite loops
- Graceful degradation when tools fail

### Extending the Agent

To add new tools:

1. Add tool definition to the `tools` object:
```typescript
my_tool: {
  description: "Description of what the tool does",
  schema: z.object({
    // Define parameters with Zod
    param1: z.string(),
    param2: z.number().optional()
  }),
  impl: async ({ param1, param2 }) => {
    // Tool implementation
    return { result: "success" };
  }
}
```

2. The tool will automatically be available to the AI model

### Testing

Run the agent tests:
```bash
# Basic functionality tests
npm test -- --run src/chat/chat-agentic-agent.test.ts

# Tool injection tests
npm test -- --run src/chat/chat-agentic-agent-integration.test.ts

# Simple tool injection tests
npm test -- --run src/chat/chat-agentic-agent-simple.test.ts

# Real AI integration tests (requires OpenAI API key)
npm test -- --run src/chat/chat-agentic-agent-real.test.ts
```

#### Real AI Integration Test Results

The real AI integration tests demonstrate the agentic loop working with actual OpenAI models:

1. **Single Tool Usage**: AI successfully calls `get_random_number` and returns "6931"
2. **Multiple Tool Sequence**: AI calls `get_random_number` → gets 6931, then calls `multiply_by_factor` → gets 13862
3. **Complex Multi-step Process**: AI performs a 3-step process:
   - Get random number: 6931
   - Add 100: 7031  
   - Multiply by 3: 21093

All tests verify that the deterministic tool results (6931) are correctly returned and used by the AI in the final response.

## Migration from SimpleChatAgent

The `ChatAppBackend` has been updated to use `ChatAgent` instead of `SimpleChatAgent`. The new agent provides the same interface but with additional agentic capabilities.

### Benefits
- **Tool Usage**: AI can actively use tools to gather information
- **Multi-step Reasoning**: Complex tasks can be broken down into multiple steps
- **External Data Access**: Can read URLs and search the web (when implemented)
- **Structured Completion**: Uses finish tool to provide clear task completion signals
- **Deterministic Testing**: Custom tools can be injected for reliable testing and verification
- **Real AI Integration**: Successfully tested with actual OpenAI models using deterministic tools

### Considerations
- **API Costs**: Tool usage may increase API costs due to multiple model calls
- **Response Time**: Agentic loops may take longer than single-turn responses
- **Complexity**: More complex error handling and state management