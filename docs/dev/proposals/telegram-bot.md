# Sila Telegram Bot Integration Proposal

This proposal outlines the architecture and implementation steps to create a Telegram Bot powered by Sila Workspaces and Agents.

## Objective

Enable users to create Telegram bots that delegate conversation handling to Sila Agents. The bot will run as a standalone Node.js service, leveraging the `@sila/core` library to manage state (Spaces) and execute agents.

## Architecture

The solution involves creating a new workspace (e.g., `packages/telegram-bot`) that acts as a bridge between the Telegram Bot API and the Sila Core logic.

### High-Level Flow

1.  **Telegram User** sends a message.
2.  **Bot Service** receives the webhook/polling update.
3.  **Bot Service** resolves the Telegram Chat ID to a Sila **Thread ID**.
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

Unlike the Desktop app, the Bot runs headlessly. We will use `SpaceManager` and `FileSystemPersistenceLayer` to load a Space from a local directory.

**Data Mapping:**
We need to map Telegram Chat IDs to Sila Thread IDs. We can store this mapping in a JSON file within the Space itself (e.g., `files/telegram-mapping.json`) or in a simple local database.

### 3. Core Bridge Logic

The core logic requires a `BotRunner` class that manages active conversations.

#### Initialization (Pseudocode)

```typescript
import { SpaceManager, FileSystemPersistenceLayer, ChatAppData } from "@sila/core";
import { setHttpRequestImpl } from "aiwrapper";
import TelegramBot from "node-telegram-bot-api";

// 1. Setup Environment
setHttpRequestImpl(fetch); // Use Node.js native fetch for AI requests

// 2. Load Space
const spaceManager = new SpaceManager();
const layer = new FileSystemPersistenceLayer("./bot-data");
const space = await spaceManager.loadSpace({ id: "bot-space", ... }, [layer]);

// 3. Setup Bot
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// 4. Handle Messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  // A. Resolve or Create Thread
  const threadId = await resolveThreadForChat(space, chatId);
  const appTree = await space.loadAppTree(threadId);
  const chatData = new ChatAppData(space, appTree);

  // B. Ensure Agent is Running
  ensureAgentRunning(chatData, appTree);

  // C. Add User Message
  await chatData.newMessage({ role: "user", text: msg.text });
});
```

#### The Agent Loop

We need a manager to keep `WrapChatAgent` instances alive for active threads.

```typescript
const activeAgents = new Map<string, WrapChatAgent>();

function ensureAgentRunning(chatData: ChatAppData, appTree: AppTree) {
  const threadId = chatData.threadId;
  if (activeAgents.has(threadId)) return;

  const agentServices = new AgentServices(chatData.getSpace());
  const agent = new WrapChatAgent(chatData, agentServices, appTree);

  // Start the agent loop
  // Note: We might need to expose runInternal or a public run() method on WrapChatAgent
  // or simply rely on its reactive constructor/init logic if adapted.
  // Ideally, WrapChatAgent should have a public .start() method.

  // Create a subclass or modify WrapChatAgent to expose the runner
  class HeadlessChatAgent extends WrapChatAgent {
    public start() { this.runInternal(); }
  }

  const runner = new HeadlessChatAgent(chatData, agentServices, appTree);
  runner.start();

  activeAgents.set(threadId, runner);

  // Clean up idle agents after N minutes?
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

*Refinement:* To support streaming or updates, we can track `lastMsg.text` changes and edit the Telegram message.

## Action Plan

1.  **Scaffold Package**: Initialize `packages/telegram-bot`.
2.  **Space Loader**: Implement a robust `loadBotSpace()` utility using `SpaceManager`.
3.  **Thread Manager**: Implement `TelegramThreadManager` to handle `Chat ID -> Thread ID` persistence.
4.  **Agent Runner**: Extend or wrap `WrapChatAgent` to work reliably in a long-running Node process (handling errors, restarts, and cleanup).
5.  **Bot Interface**: Implement the Telegram polling loop and message handlers.

## Considerations

*   **Concurrency**: Node.js is single-threaded, which is fine for I/O. For heavy load, we might need multiple instances, but they must coordinate on the Space (File System locking might be an issue). For a simple bot, a single process is sufficient.
*   **Authentication**: The current proposal assumes a single "Bot Space". If we want multi-tenant (users accessing *their* private spaces), we would need an auth flow (User sends Token -> Bot loads that specific Space).
*   **Dependencies**: Ensure `@sila/core` exports all necessary classes (`WrapChatAgent`, `AgentServices`). We might need to adjust `index.ts` exports if anything is internal.
