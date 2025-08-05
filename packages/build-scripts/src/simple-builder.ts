import { NodeFileSystem } from './node-file-system';
import { Space, SpaceManager, uuid, FileSystemPersistenceLayer, AppTree, ChatAppData } from "@supa/core";
import { rm } from 'fs/promises';
import { existsSync } from 'fs';

interface DemoSpaceConfig {
  type: "supa-space";
  version: "1";
  name: string;
  createdAt: string;
  description?: string;
  assistants: AssistantConfig[];
  providers: ProviderConfig[];
  conversations: ConversationConfig[];
}

interface AssistantConfig {
  id: string;
  name: string;
  button: string;
  visible?: boolean;
  description: string;
  instructions: string;
  targetLLM?: string;
}

interface ProviderConfig {
  id: string;
  apiKey?: string;
}

interface ConversationConfig {
  title: string;
  assistant: string;
  messages: MessageNode;
}

interface MessageNode {
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  main?: boolean;
  children?: MessageNode[];
}

export class SimpleDemoBuilder {
  async buildFromConfig(config: DemoSpaceConfig, outputPath: string): Promise<string> {
    console.log(`Building demo space: ${config.name}`);
    console.log(`Output path: ${outputPath}`);
    
    try {
      // Clean up existing demo-space directory if it exists
      if (existsSync(outputPath)) {
        console.log(`🧹 Cleaning up existing directory: ${outputPath}`);
        await rm(outputPath, { recursive: true, force: true });
      }
      
      // Create new space using the real Space API
      const space = Space.newSpace(uuid());
      const spaceId = space.getId();
      
      // Set space name
      space.name = config.name;

      // Create Node.js file system and persistence layer
      const fs = new NodeFileSystem();
      const persistenceLayer = new FileSystemPersistenceLayer(outputPath, spaceId, fs);
      
      // Create space manager and add the space
      const spaceManager = new SpaceManager();
      await spaceManager.addNewSpace(space, [persistenceLayer]);

      // Add assistants using the real Space API
      for (const assistant of config.assistants) {
        const assistantConfig = {
          id: assistant.id,
          name: assistant.name,
          button: assistant.button,
          visible: assistant.visible ?? true,
          description: assistant.description,
          instructions: assistant.instructions,
          targetLLM: assistant.targetLLM
        };
        space.addAppConfig(assistantConfig);
      }

      // Add providers using the real Space API
      for (const provider of config.providers) {
        if (provider.apiKey) {
          const providerConfig = {
            id: provider.id,
            type: "cloud" as const,
            apiKey: provider.apiKey
          };
          space.saveModelProviderConfig(providerConfig);
        }
      }

      // Add conversations using ChatAppData
      for (const conversation of config.conversations) {
        // Create chat tree using ChatAppData's static method
        const appTree = ChatAppData.createNewChatTree(space, conversation.assistant);
        
        // Set the title
        space.setAppTreeName(appTree.getId(), conversation.title);
        
        // Create ChatAppData instance to add messages
        const chatData = new ChatAppData(space, appTree);
        
        // Add messages to the conversation using proper tree structure
        this.addMessagesToChatData(chatData, conversation.messages);
      }

      // Give operations time to flush to disk
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(`✅ Demo space created successfully!`);
      console.log(`📁 Output: ${outputPath}`);
      console.log(`🆔 Space ID: ${spaceId}`);
      console.log(`\n💡 You can now open this space in Supa!`);
      
      // Log what was created
      console.log(`\n📋 Space contents:`);
      console.log(`- Assistants: ${config.assistants.length}`);
      config.assistants.forEach(assistant => {
        console.log(`  • ${assistant.name} (${assistant.id})`);
      });
      
      console.log(`- Providers: ${config.providers.length}`);
      config.providers.forEach(provider => {
        console.log(`  • ${provider.id}${provider.apiKey ? ' (with API key)' : ''}`);
      });
      
      console.log(`- Conversations: ${config.conversations.length}`);
      config.conversations.forEach(conversation => {
        console.log(`  • ${conversation.title} (assistant: ${conversation.assistant})`);
      });
      
      return spaceId;
    } catch (error) {
      console.error('Error creating space:', error);
      throw error;
    }
  }

  addMessagesToChatData(chatData: ChatAppData, messageNode: MessageNode): void {
    // Add messages recursively, building the tree structure
    this.addMessageToChatData(chatData, messageNode);
  }

  private addMessageToChatData(chatData: ChatAppData, messageNode: MessageNode): void {
    // Use ChatAppData's newMessage method to add the message
    const message = chatData.newMessage(messageNode.role, messageNode.text);
    
    // If this message has children, add them as the next messages in the conversation
    if (messageNode.children && messageNode.children.length > 0) {
      // Add all children as subsequent messages
      for (const child of messageNode.children) {
        this.addMessageToChatData(chatData, child);
      }
    }
  }
} 