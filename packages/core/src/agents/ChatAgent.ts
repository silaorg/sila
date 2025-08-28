import type { LangChatMessage, LangContentPart } from "aiwrapper";
import { LangChatMessageCollection } from "aiwrapper";
import { z } from "zod";
import { FileReference, FileResolver } from "../spaces/files/FileResolver";
import { AppConfig, ThreadMessage } from "../models";
import { Agent, AgentInput, AgentOutput } from "./Agent";
import type { AppConfigForChat } from "./SimpleChatAgent";
import { AgentServices } from "./AgentServices";

// AppConfigForChat is already exported from SimpleChatAgent

// Tool definitions with schemas and implementations
type ToolImpl = (args: any) => Promise<any>;

interface ToolDefinition {
  description: string;
  schema: any;
  impl: ToolImpl;
}

export class ChatAgent extends Agent<AppConfigForChat> {
  hasStopped = false;
  private readonly MAX_STEPS = 12;

  // Tool definitions
  private tools: Record<string, ToolDefinition> = {
    read_url: {
      description: "Read content from a URL and return the text content. Use this to gather information from web pages.",
      schema: z.object({
        url: z.string().url("Must be a valid URL")
      }),
      impl: async ({ url }: { url: string }) => {
        // Dummy implementation - returns mock content
        return {
          url,
          content: `This is dummy content from ${url}. In a real implementation, this would fetch and parse the actual webpage content.`,
          title: `Dummy Page - ${url}`,
          status: "success"
        };
      }
    },
    web_search: {
      description: "Search the web for information. Use this to find current information, facts, or recent developments.",
      schema: z.object({
        query: z.string().min(3, "Search query must be at least 3 characters"),
        max_results: z.number().int().min(1).max(10).optional()
      }),
      impl: async ({ query, max_results = 5 }: { query: string; max_results?: number }) => {
        // Dummy implementation - returns mock search results
        const results = [];
        for (let i = 1; i <= max_results; i++) {
          results.push({
            title: `Dummy Search Result ${i} for "${query}"`,
            url: `https://example.com/result-${i}`,
            snippet: `This is a dummy search result snippet for the query "${query}". In a real implementation, this would contain actual search results from a search engine.`
          });
        }
        return {
          query,
          results,
          total_results: max_results
        };
      }
    },
    finish: {
      description: "Signal that the task is complete and provide a final summary. Use this when you have answered the user's question or completed the requested task.",
      schema: z.object({
        summary: z.string().min(1, "Summary cannot be empty"),
        files_created: z.array(z.string()).optional()
      }),
      impl: async ({ summary, files_created = [] }: { summary: string; files_created?: string[] }) => {
        return { summary, files_created };
      }
    }
  };

  constructor(services: AgentServices, config: AppConfigForChat, customTools?: Record<string, ToolDefinition>) {
    super(services, config);
    
    // Inject custom tools if provided
    if (customTools) {
      this.tools = { ...this.tools, ...customTools };
    }
  }

  // Convert tool schemas to AIWrapper tools format
  private getAITools() {
    return Object.entries(this.tools).map(([name, tool]) => ({
      name,
      description: tool.description,
      parameters: this.zodToJsonSchema(tool.schema)
    }));
  }

  // Simple zod -> JSON Schema converter
  private zodToJsonSchema(schema: any): any {
    const def = schema._def;
    const kind = def?.typeName;
    
    switch (kind) {
      case z.ZodFirstPartyTypeKind.ZodObject: {
        const shape = def.shape();
        const properties: Record<string, any> = {};
        const required: string[] = [];
        
        for (const [k, v] of Object.entries(shape)) {
          properties[k] = this.zodToJsonSchema(v);
          const vAny: any = v;
          const isOptional = typeof vAny?.isOptional === "function" && vAny.isOptional();
          if (!isOptional) required.push(k);
        }
        
        return { type: "object", properties, required };
      }
      case z.ZodFirstPartyTypeKind.ZodString:
        return { type: "string" };
      case z.ZodFirstPartyTypeKind.ZodNumber:
        return { type: "number" };
      case z.ZodFirstPartyTypeKind.ZodBoolean:
        return { type: "boolean" };
      case z.ZodFirstPartyTypeKind.ZodEnum:
        return { type: "string", enum: def.values };
      case z.ZodFirstPartyTypeKind.ZodOptional:
        return this.zodToJsonSchema(def.innerType);
      default:
        return {};
    }
  }

  // Tool registry that validates args via Zod before invoking implementations
  private getToolRegistry(): Record<string, (args: Record<string, any>) => Promise<any>> {
    return Object.fromEntries(
      Object.entries(this.tools).map(([name, tool]) => [
        name,
        async (args: Record<string, any>) => {
          try {
            const parsed = tool.schema.parse(args ?? {});
            const result = await tool.impl(parsed);
            return result;
          } catch (e: any) {
            return { error: `Tool ${name} error: ${e?.message || String(e)}` };
          }
        }
      ])
    );
  }

  async input(
    payload: AgentInput,
    onStream?: (output: AgentOutput) => void,
  ): Promise<AgentOutput> {
    this.hasStopped = false;
    const messages = payload as ThreadMessage[];

    const lang = await this.services.lang(this.config.targetLLM);
    const resolvedModel = this.services.getLastResolvedModel();

    // Build system prompt
    let systemPrompt = this.config.instructions + "\n\n" +
      "You are an AI assistant with access to tools that can help you gather information and complete tasks.\n\n" +
      "Available tools:\n" +
      "- read_url: Read content from web pages\n" +
      "- web_search: Search the web for information\n" +
      "- finish: Signal task completion\n\n" +
      "Use these tools when needed to provide accurate and up-to-date information. " +
      "When you have completed the user's request, use the finish tool to provide a final summary.\n\n" +
      "Preferably use markdown for formatting. If you write code examples: use tick marks for inline code and triple tick marks for code blocks.\n\n" +
      "For math, use TeX with inline $ ... $ and block $$ ... $$ delimiters.\n\n" +
      "Current date and time: " + new Date().toLocaleString();

    if (resolvedModel) {
      systemPrompt += `\n\n[Meta] Model: ${resolvedModel.provider}/${resolvedModel.model}`;
    }
    if (this.config.name) {
      systemPrompt += `\n[Meta] Assistant Config: ${this.config.name}`;
    }

    // Parse and prepare messages
    const remappedMessages = await this.prepareMessages(messages, systemPrompt);
    
    // Initialize conversation
    const messagesCollection = new LangChatMessageCollection();
    messagesCollection.addSystemMessage(systemPrompt);
    
    // Add user messages
    for (const msg of remappedMessages) {
      if (msg.role === "user") {
        messagesCollection.addUserMessage(msg.content);
      }
    }

    const aiTools = this.getAITools();
    const toolRegistry = this.getToolRegistry();

    // Agentic loop with proper tool handling
    let result = await lang.chat(messagesCollection, { tools: aiTools as any });
    let stepCount = 0;
    const maxSteps = 5; // Prevent infinite loops

    while (stepCount < maxSteps) {
      stepCount++;

      // Stream current response if available
      if (result.answer && onStream) {
        onStream({
          text: result.answer,
          thinking: (result as any).thinking,
        });
      }

      // If no tools were called, we're done
      if (!result.tools || result.tools.length === 0) {
        break;
      }

      // Execute tools
      const toolResults: { toolId: string; result: any }[] = [];
      let finishPayload: { summary: string; files_created?: string[] } | null = null;

      for (const call of result.tools) {
        const fn = toolRegistry[call.name];
        if (!fn) continue;

        const out = await Promise.resolve(fn(call.arguments || {}));
        
        if (call.name === "finish") {
          if (out && typeof out === "object" && "summary" in out) {
            finishPayload = out as any;
          } else if (call.arguments && (call.arguments as any).summary) {
            finishPayload = call.arguments as any;
          }
        }
        
        toolResults.push({ toolId: call.id, result: out });
      }

      // If finish was called, return the summary
      if (finishPayload) {
        return {
          text: finishPayload.summary,
          thinking: (result as any).thinking
        };
      }

      // First, add the assistant message with tool_calls
      result.messages.push({
        role: 'assistant',
        content: result.answer || '',
        tool_calls: result.tools.map(tool => ({
          id: tool.id,
          type: 'function',
          function: {
            name: tool.name,
            arguments: JSON.stringify(tool.arguments || {})
          }
        }))
      });

      // Then add tool results using aiwrapper's method
      result.addToolUseMessage(toolResults);

      // Continue conversation
      result = await lang.chat(result.messages, { tools: aiTools as any });
    }

    return {
      text: result.answer || "I've reached the maximum number of steps. Please try rephrasing your request.",
      thinking: (result as any).thinking
    };
  }

  private async prepareMessages(messages: ThreadMessage[], systemPrompt: string): Promise<LangChatMessage[]> {
    const supportsVision = true;

    function parseDataUrl(dataUrl: string): { base64: string; mimeType?: string } {
      try {
        const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
        if (match && match[2]) {
          return { mimeType: match[1], base64: match[2] };
        }
      } catch {}
      return { base64: dataUrl };
    }

    return await Promise.all(messages.map(async (m) => {
      let normalizedRole = (m.role || "user");
      if (normalizedRole !== "assistant" && normalizedRole !== "user") {
        normalizedRole = "user";
      }

      const hasFiles = Array.isArray((m as any).files) && (m as any).files.length > 0;
      if (!hasFiles) {
        return {
          role: normalizedRole as "assistant" | "user",
          content: m.text || "",
        } as LangChatMessage;
      }

      const fileRefs = (m as any).files as Array<FileReference>;
      const resolver = new FileResolver(this.services.space);
      const resolved = await resolver.getFileData(fileRefs);
      const images = resolved.filter(a => a?.kind === 'image');
      const textFiles = resolved.filter(a => a?.kind === 'text');

      // Build content parts for vision-capable models with images
      if (supportsVision && images.length > 0) {
        const parts: LangContentPart[] = [];
        
        // Add text content first
        if (m.text && m.text.trim().length > 0) {
          parts.push({ type: 'text', text: m.text });
        }
        
        // Add text file contents
        for (const textFile of textFiles) {
          const fileContent = this.extractTextFromDataUrl(textFile.dataUrl);
          if (fileContent) {
            const fileHeader = `\n\n--- File: ${textFile.name} ---\n`;
            parts.push({ type: 'text', text: fileHeader + fileContent });
          }
        }
        
        // Add images
        for (const img of images) {
          const { base64, mimeType } = parseDataUrl(img.dataUrl as string);
          parts.push({ type: 'image', image: { kind: 'base64', base64, mimeType } });
        }
        
        return { role: normalizedRole as "assistant" | "user", content: parts } as LangChatMessage;
      }

      // Handle text-only content
      let content = m.text || "";
      
      // Add text file contents
      for (const textFile of textFiles) {
        const fileContent = this.extractTextFromDataUrl(textFile.dataUrl);
        if (fileContent) {
          const fileHeader = `\n\n--- File: ${textFile.name} ---\n`;
          content += fileHeader + fileContent;
        }
      }
      
      // Add image descriptions for non-vision models
      if (images.length > 0) {
        const names = images.map((a) => a.name).filter(Boolean).join(', ');
        content += `\n\n[User attached ${images.length} image(s): ${names}]`;
      }
      
      return {
        role: normalizedRole as "assistant" | "user",
        content: content,
      } as LangChatMessage;
    }));
  }

  stop(): void {
    this.hasStopped = true;
  }

  // Helper function to extract text content from data URL
  private extractTextFromDataUrl(dataUrl: string): string | null {
    try {
      const textDataUrlMatch = dataUrl.match(/^data:(text\/[^;]+);base64,(.+)$/);
      if (!textDataUrlMatch) {
        return null;
      }
      
      const [, mimeType, base64] = textDataUrlMatch;
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (error) {
      console.warn('Failed to extract text from data URL:', error);
      return null;
    }
  }
}