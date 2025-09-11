import { type AppConfig, type ThreadMessage } from "../models";
import { Space } from "../spaces/Space";
import { AgentServices } from "../agents/AgentServices";
import { ChatAgent } from "../agents/ChatAgent";
import { ThreadTitleAgent } from "../agents/ThreadTitleAgent";
import { ChatAppData } from "../spaces/ChatAppData";
import { AppTree } from "../spaces/AppTree";
import { splitModelString } from "../utils/modelUtils";

export default class ChatAppBackend {
  private data: ChatAppData;
  private activeAgent: ChatAgent | null = null;

  get appTreeId(): string {
    return this.appTree.tree.root!.id;
  }

  constructor(private space: Space, private appTree: AppTree) {
    this.data = new ChatAppData(this.space, appTree);

    this.processMessages(this.data.messageVertices.map(v => v.getAsTypedObject<ThreadMessage>()));

    this.data.observeNewMessages((vertices) => {
      this.processMessages(vertices.map(v => v.getAsTypedObject<ThreadMessage>()));
    });

    this.appTree.onEvent('retry-message', (event) => {
      const messageId = event.messageId;

      if (!messageId) {
        return;
      }

      const vertices = this.data.messageVertices;
      const messages = vertices.map(v => v.getAsTypedObject<ThreadMessage>());
      this.replyToMessage(messages);
    });

    // Re-run any assistant message in a new branch
    this.appTree.onEvent('rerun-message', (event) => {
      const messageId = event.messageId as string | undefined;
      if (!messageId) return;
      try {
        this.rerunAssistantMessage(messageId).catch((e) => {
          console.error('Failed to rerun message', e);
        });
      } catch (e) {
        console.error('Failed to start rerun', e);
      }
    });

    this.appTree.onEvent("stop-message", (event) => {
      if (this.activeAgent) {
        this.activeAgent.stop();
      }

      // Get the last message and set inProgress to false
      const vertices = this.data.messageVertices;
      const lastVertex = vertices[vertices.length - 1];
      if (lastVertex && this.data.getMessageProperty(lastVertex.id, "role") === "assistant") {
        this.appTree.tree.setVertexProperty(lastVertex.id, "inProgress", false);
      }

    });
  }

  private processMessages(messages: ThreadMessage[]) {
    if (messages.length === 0) {
      return;
    }

    if (messages[messages.length - 1].role === "user") {
      this.replyToMessage(messages);
    }
  }

  private async replyToMessage(messages: ThreadMessage[]) {
    let config: AppConfig | undefined = this.data.configId ?
      this.space.getAppConfig(this.data.configId) : undefined;

    // If no config is selected, try to use the default config
    if (!config) {
      config = this.space.getAppConfig("default");
      if (config) {
        // Update the app tree to use default config
        this.data.configId = "default";
      }
    }

    if (!config) {
      throw new Error("No config found");
    }

    const agentServices = new AgentServices(this.space);
    const chatAgent = new ChatAgent(agentServices, config);
    this.activeAgent = chatAgent;
    const threadTitleAgent = new ThreadTitleAgent(agentServices, config);

    // Check if the last message is an error that we can reuse
    const lastMessage = messages[messages.length - 1];
    const messageToUse = lastMessage?.role === "error" ?
      lastMessage :
      await this.data.newMessage("assistant", "thinking...");

    // @TODO: consider making TypedVertex<ThreadMessage> that can be used to set properties
    // @TODO: or consider just having data.updateMessage(message)

    // Set initial state
    this.appTree.tree.setVertexProperty(messageToUse.id, "role", "assistant");
    this.appTree.tree.setVertexProperty(messageToUse.id, "text", "thinking...");
    this.appTree.tree.setVertexProperty(messageToUse.id, "inProgress", true);
    this.appTree.tree.setVertexProperty(messageToUse.id, "configId", config.id);
    this.appTree.tree.setVertexProperty(messageToUse.id, "configName", config.name);
    // If targetLLM is explicitly set and not 'auto', pre-populate model info
    if (config.targetLLM && !config.targetLLM.endsWith("auto")) {
      const parts = splitModelString(config.targetLLM);
      if (parts) {
        this.appTree.tree.setVertexProperty(messageToUse.id, "modelProvider", parts.providerId);
        this.appTree.tree.setVertexProperty(messageToUse.id, "modelId", parts.modelId);
      }
    }

    try {
      // If we're retrying an error message, exclude it from the input
      const messagesToUse = lastMessage?.role === "error" ?
        messages.slice(0, -1) :
        messages;

      // Pass through FileReference[] and let the agent resolve as needed
      const messagesForLang = [
        { role: "system", text: config.instructions },
        ...messagesToUse.map((m) => ({
          id: (m as any).id,
          role: m.role,
          text: m.text,
          files: (m as any).files,
        }))
      ];

      let modelSaved = false;
      const initialResponse = await chatAgent.input(messagesForLang, (resp) => {
        this.appTree.tree.setTransientVertexProperty(messageToUse.id, "text", resp.text);
        if (resp.thinking && resp.thinking.trim().length > 0) {
          this.appTree.tree.setTransientVertexProperty(messageToUse.id, "thinking", resp.thinking);
        }
        // Save model info as soon as it is resolved on first stream callback
        if (!modelSaved) {
          const info = agentServices.getLastResolvedModel();
          if (info) {
            this.appTree.tree.setVertexProperty(messageToUse.id, "modelProvider", info.provider);
            this.appTree.tree.setVertexProperty(messageToUse.id, "modelId", info.model);
            // @TODO: huh, do we need this? I don't think so.
            // Freeze the values so they don’t change if config changes later
            this.appTree.tree.setVertexProperty(messageToUse.id, "modelProviderFinal", info.provider);
            this.appTree.tree.setVertexProperty(messageToUse.id, "modelIdFinal", info.model);
            modelSaved = true;
          }
        }
      });

      // Update the message with the final response
      this.appTree.tree.setVertexProperty(messageToUse.id, "text", initialResponse.text);
      this.appTree.tree.setVertexProperty(messageToUse.id, "inProgress", false);
      if (initialResponse.thinking && initialResponse.thinking.trim().length > 0) {
        this.appTree.tree.setVertexProperty(messageToUse.id, "thinking", initialResponse.thinking);
      }
      // Save model info used for this response
      const modelInfo = agentServices.getLastResolvedModel();
      if (modelInfo) {
        this.appTree.tree.setVertexProperty(messageToUse.id, "modelProvider", modelInfo.provider);
        this.appTree.tree.setVertexProperty(messageToUse.id, "modelId", modelInfo.model);
        this.appTree.tree.setVertexProperty(messageToUse.id, "modelProviderFinal", modelInfo.provider);
        this.appTree.tree.setVertexProperty(messageToUse.id, "modelIdFinal", modelInfo.model);
      }
      this.activeAgent = null;

      // Only add to messages array if it's a new message
      if (lastMessage?.role !== "error") {
        messages.push({ ...messageToUse, text: initialResponse.text, thinking: initialResponse.thinking });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      this.appTree.tree.setVertexProperty(messageToUse.id, "role", "error");
      this.appTree.tree.setVertexProperty(messageToUse.id, "text", errorMessage);
      this.appTree.tree.setVertexProperty(messageToUse.id, "inProgress", false);
    }

    try {
      const newTitle = await threadTitleAgent.input({
        messages,
        title: this.data.title
      });

      if (newTitle.text !== this.data.title) {
        this.data.title = newTitle.text;
      }

      this.space.setAppTreeName(this.appTreeId, this.data.title);
    }
    catch (error) {
      console.error("Error while updating title", error);
    }
  }

  // Generate a new assistant reply as a sibling branch for the specified assistant message
  private async rerunAssistantMessage(targetAssistantMessageId: string) {
    const data = this.data;
    const { vertices, messages } = data.getMessagePath(targetAssistantMessageId);
    if (vertices.length === 0) return;

    // Expect the path to end with [ ... , userMsg, assistantMsg(target) ]
    if (messages.length < 2) return;
    const targetIdx = messages.length - 1;
    const target = messages[targetIdx];
    const parentUser = messages[targetIdx - 1];
    if (target.role !== 'assistant' || parentUser.role !== 'user') {
      // Only support rerunning assistant directly following a user message
      return;
    }

    // Prepare input up to and including the user message
    const inputMessages = messages.slice(0, targetIdx); // excludes the assistant

    // Resolve config
    let config: AppConfig | undefined = this.data.configId ? this.space.getAppConfig(this.data.configId) : undefined;
    if (!config) {
      config = this.space.getAppConfig('default');
      if (config) this.data.configId = 'default';
    }
    if (!config) throw new Error('No config found');

    const agentServices = new AgentServices(this.space);
    const chatAgent = new ChatAgent(agentServices, config);
    this.activeAgent = chatAgent;

    // Create a new assistant message under the parent user as a sibling branch
    const parentVertexId = vertices[targetIdx - 1].id; // user vertex id
    const newAssistant = data.newMessageUnder(parentVertexId, 'assistant', 'thinking...');

    // Make the new assistant branch the main one immediately and demote siblings
    const parentVertex = this.appTree.tree.getVertex(parentVertexId);
    if (parentVertex) {
      for (const child of parentVertex.children) {
        this.appTree.tree.setVertexProperty(child.id, 'main', child.id === newAssistant.id);
      }
    }

    // Set initial state and config info
    this.appTree.tree.setVertexProperty(newAssistant.id, 'inProgress', true);
    this.appTree.tree.setVertexProperty(newAssistant.id, 'configId', config.id);
    this.appTree.tree.setVertexProperty(newAssistant.id, 'configName', config.name);
    if (config.targetLLM && !config.targetLLM.endsWith('auto')) {
      const parts = splitModelString(config.targetLLM);
      if (parts) {
        this.appTree.tree.setVertexProperty(newAssistant.id, 'modelProvider', parts.providerId);
        this.appTree.tree.setVertexProperty(newAssistant.id, 'modelId', parts.modelId);
      }
    }

    const messagesForLang = [
      { role: 'system', text: config.instructions },
      ...inputMessages.map((m) => ({ role: m.role, text: m.text, files: m.files }))
    ];

    try {
      let modelSaved = false;
      const initialResponse = await chatAgent.input(messagesForLang, (resp) => {
        this.appTree.tree.setTransientVertexProperty(newAssistant.id, 'text', resp.text);
        if (resp.thinking && resp.thinking.trim().length > 0) {
          this.appTree.tree.setTransientVertexProperty(newAssistant.id, 'thinking', resp.thinking);
        }
        if (!modelSaved) {
          const info = agentServices.getLastResolvedModel();
          if (info) {
            this.appTree.tree.setVertexProperty(newAssistant.id, 'modelProvider', info.provider);
            this.appTree.tree.setVertexProperty(newAssistant.id, 'modelId', info.model);
            this.appTree.tree.setVertexProperty(newAssistant.id, 'modelProviderFinal', info.provider);
            this.appTree.tree.setVertexProperty(newAssistant.id, 'modelIdFinal', info.model);
            modelSaved = true;
          }
        }
      });

      this.appTree.tree.setVertexProperty(newAssistant.id, 'text', initialResponse.text);
      this.appTree.tree.setVertexProperty(newAssistant.id, 'inProgress', false);
      if (initialResponse.thinking && initialResponse.thinking.trim().length > 0) {
        this.appTree.tree.setVertexProperty(newAssistant.id, 'thinking', initialResponse.thinking);
      }
      const modelInfo = agentServices.getLastResolvedModel();
      if (modelInfo) {
        this.appTree.tree.setVertexProperty(newAssistant.id, 'modelProvider', modelInfo.provider);
        this.appTree.tree.setVertexProperty(newAssistant.id, 'modelId', modelInfo.model);
        this.appTree.tree.setVertexProperty(newAssistant.id, 'modelProviderFinal', modelInfo.provider);
        this.appTree.tree.setVertexProperty(newAssistant.id, 'modelIdFinal', modelInfo.model);
      }
      this.activeAgent = null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      this.appTree.tree.setVertexProperty(newAssistant.id, 'role', 'error');
      this.appTree.tree.setVertexProperty(newAssistant.id, 'text', errorMessage);
      this.appTree.tree.setVertexProperty(newAssistant.id, 'inProgress', false);
    }
  }
}