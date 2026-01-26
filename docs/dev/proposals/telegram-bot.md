# Sila Telegram Bot Integration Proposal

This proposal outlines the architecture and implementation steps to create a Telegram Bot powered by Sila Workspaces and Agents.

## Objective

Enable users to create Telegram bots that delegate conversation handling to Sila Agents. The bot will run as a standalone Node.js service, leveraging the `@sila/core` library to manage state (Spaces) and execute agents.

## Architecture

The solution involves creating a new workspace (e.g., `packages/telegram-bot`) that acts as a bridge between the Telegram Bot API and the Sila Core logic.

### High-Level Flow

1.  **Telegram User** sends a message.
2.  **Bot Service** receives the webhook/polling update.
3.  **Bot Service** resolves the Telegram Chat ID to a Sila **Thread ID** by querying the Space tree.
4.  **Sila Core** (`ChatAppData`) appends the user message to the thread.
5.  **WrapChatAgent** (running in the background) detects the new message.
6.  **WrapChatAgent** invokes the LLM (via `aiwrapper`).
7.  **Bot Service** observes the Sila Thread for new `assistant` messages.
8.  **Bot Service** sends the generated response back to Telegram.

### Component Diagram

```mermaid
graph LR
    User[Telegram User] -- Message --> Bot[Bot Service (Node.js)]
    Bot -- Load/Persist --> Space[Sila Space (File System)]
    Bot -- Append Msg --> Thread[Chat Thread (AppTree)]
    Agent[WrapChatAgent] -- Observe --> Thread
    Agent -- Generate --> Thread
    Thread -- Update Event --> Bot
    Bot -- Send Reply --> User
```

## Implementation Details

### 1. New Workspace

Create a new package `packages/telegram-bot`:

```json
{
  "name": "@sila/telegram-bot",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@sila/core": "workspace:*",
    "node-telegram-bot-api": "^0.61.0",
    "dotenv": "^16.0.0",
    "aiwrapper": "^3.0.1"
  }
}
```

### 2. State Management (Headless Space)

The Bot runs headlessly using `SpaceManager` and `FileSystemPersistenceLayer`.

**Data Mapping:**
Instead of an external database, we map Telegram Chat IDs to Sila Threads directly within the Space structure.
The `Space` tree contains a `threads` vertex where children represent active threads. We will store the `telegramChatId` as a property on these reference vertices.

```typescript
// Space Tree Structure Concept
threads/
  ├── [Vertex ID: A] (tid: "thread-uuid-1", telegramChatId: "12345")
  ├── [Vertex ID: B] (tid: "thread-uuid-2", telegramChatId: "67890")
```

### 3. Core Bridge Logic

The core logic requires a `BotRunner` class that manages active conversations.

#### Initialization & Thread Resolution

```typescript
import { SpaceManager, FileSystemPersistenceLayer, ChatAppData, Space } from "@sila/core";
import { setHttpRequestImpl } from "aiwrapper";
import TelegramBot from "node-telegram-bot-api";

// ... setup (env, fetch injection, space loading) ...

async function resolveThreadForChat(space: Space, telegramChatId: number): Promise<string> {
  const chatIdStr = telegramChatId.toString();

  // 1. Search existing threads in the Space index
  const threadsVertex = space.appTreesVertex; // The "threads" vertex
  for (const refVertex of threadsVertex.children) {
    if (refVertex.getProperty("telegramChatId") === chatIdStr) {
      return refVertex.getProperty("tid") as string;
    }
  }

  // 2. Create new thread if not found
  // We use a simplified chat tree initialization suitable for bots
  const appTree = ChatAppData.createNewChatTree(space, "default");
  const threadId = appTree.getId();

  // 3. Tag the reference vertex with the Telegram Chat ID
  const refVertex = space.getVertexReferencingAppTree(threadId);
  if (refVertex) {
    refVertex.setProperty("telegramChatId", chatIdStr);
  }

  return threadId;
}

// ... bot message handler calls resolveThreadForChat ...
```

#### The Agent Loop

We need a manager to keep `WrapChatAgent` instances alive for active threads.

```typescript
const activeAgents = new Map<string, WrapChatAgent>();

function ensureAgentRunning(chatData: ChatAppData, appTree: AppTree) {
  const threadId = chatData.threadId;
  if (activeAgents.has(threadId)) return;

  const agentServices = new AgentServices(chatData.getSpace());

  // We can create a lightweight wrapper or use WrapChatAgent directly
  // Note: Ensure WrapChatAgent exposes a method to start the loop suitable for Node.js
  const agent = new WrapChatAgent(chatData, agentServices, appTree);

  // In a headless env, we trigger the internal run loop.
  // We might need to subclass to expose `runInternal` or add a public method.
  (agent as any).runInternal();

  activeAgents.set(threadId, agent);
}
```

#### Sending Responses

We observe the `ChatAppData` for changes.

```typescript
chatData.observeMessages((messages) => {
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role === "assistant" && !lastMsg.inProgress) {
    // Send to Telegram
    bot.sendMessage(chatId, lastMsg.text);
  }
});
```

## Action Plan

1.  **Scaffold Package**: Initialize `packages/telegram-bot`.
2.  **Thread Resolution**: Implement the `resolveThreadForChat` logic using Space vertex properties.
3.  **Headless Agent**: Adapt `WrapChatAgent` (or create `HeadlessChatAgent` subclass) to expose the run loop cleanly for server-side usage.
4.  **Bot Interface**: Implement the Telegram polling loop and message handlers.
5.  **Refinement**: Consider storing `lastMessageId` processed to avoid duplicate sends on restart.

## Considerations

*   **Performance**: Iterating over `space.appTreesVertex.children` is fast for thousands of active threads. For millions, we might need a dedicated index structure within the tree, but a linear scan is sufficient for the MVP.
*   **Concurrency**: Node.js is single-threaded, which is fine for I/O.
*   **Dependencies**: Ensure `@sila/core` exports all necessary classes.
