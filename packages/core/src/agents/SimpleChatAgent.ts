import type { LangMessage, LangContentPart } from "aiwrapper";
import { FileReference, FileResolver } from "../spaces/files/FileResolver";
import { AppConfig, ThreadMessage } from "../models";
import { Agent, AgentInput, AgentOutput } from "./Agent";

export interface AppConfigForChat extends AppConfig {
  targetLLM?: string;
}

export class SimpleChatAgent extends Agent<AppConfigForChat> {
  hasStopped = false;

  async input(
    payload: AgentInput,
    onStream?: (output: AgentOutput) => void,
  ): Promise<AgentOutput> {
    this.hasStopped = false;
    const messages = payload as ThreadMessage[];

    const lang = await this.services.lang(this.config.targetLLM);
    const resolvedModel = this.services.getLastResolvedModel();

    // @TODO: move this to localized texts file
    let systemPrompt = this.config.instructions + "\n\n" +
      "Preferably use markdown for formatting. If you write code examples: use tick marks for inline code and triple tick marks for code blocks." +
      "\n\n" +
      "For math, use TeX with inline $ ... $ and block $$ ... $$ delimiters. If you want to show the source of TeX - wrap it in a code block" +
      "\n\n" +
      "Current date and time " + new Date().toLocaleString();

    // @TODO: make it clear for the LLM.
    // Add meta info to the system prompt to give the assistant context
    if (resolvedModel) {
      systemPrompt += `\n\n[Meta] Model: ${resolvedModel.provider}/${resolvedModel.model}`;
    }
    if (this.config.name) {
      systemPrompt += `\n[Meta] Assistant Config: ${this.config.name}`;
    }

    /*
    const profile = await this.services.db.getProfile();
    if (profile) {
      systemPrompt += "\n\nUser's name is " + profile?.name;
    }
    */

    // TODO: Check Lang.models using the model id and, if in our DB, verify vision capability.
    // For now, send images to every model to keep behavior consistent across providers.
    const supportsVision = true;

    function parseDataUrl(dataUrl: string): { base64: string; mimeType?: string } {
      try {
        const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
        if (match && match[2]) {
          return { mimeType: match[1], base64: match[2] };
        }
      } catch {}
      // If it's already just base64 without prefix
      return { base64: dataUrl };
    }

    const remappedMessages: LangMessage[] = [
      { role: "system", content: systemPrompt },
      ...await Promise.all(messages.map(async (m) => {
        // Validate and normalize the role - only allow "assistant" or "user"
        let normalizedRole = (m.role || "user");
        if (normalizedRole !== "assistant" && normalizedRole !== "user") {
          normalizedRole = "user";
        }

        const hasFiles = Array.isArray((m as any).files) && (m as any).files.length > 0;
        if (!hasFiles) {
          return {
            role: normalizedRole as "assistant" | "user",
            content: m.text || "",
          } as LangMessage;
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
          
          return { role: normalizedRole as "assistant" | "user", content: parts } as LangMessage;
        }

        // Handle text-only content (no images or non-vision models)
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
        } as LangMessage;
      })),
    ];

    const finalResult = await lang.chat(remappedMessages, {
      onResult: (res: any) => {
        if (this.hasStopped) {
          return;
        }

        onStream?.({
          text: res.answer,
          thinking: (res as any).thinking,
        });
      },
    });

    return {
      text: finalResult.answer,
      thinking: (finalResult as any).thinking
    };
  }

  stop(): void {
    this.hasStopped = true;
  }

  // Helper function to load text file content from CAS or data URL
  private async loadTextFileContent(treeId: string, vertexId: string): Promise<string | null> {
    try {
      // Load the file vertex to get the hash
      const appTree = await this.services.space.loadAppTree(treeId);
      if (!appTree) return null;
      
      const fileVertex = appTree.tree.getVertex(vertexId);
      if (!fileVertex) return null;
      
      const hash = fileVertex.getProperty("hash") as string;
      if (!hash) return null;

      // Load the file content from CAS
      const store = this.services.space.getFileStore();
      if (!store) return null;
      
      const fileData = await store.getBytes(hash);
      if (!fileData) return null;
      
      // Convert to text
      return new TextDecoder().decode(fileData);
    } catch (error) {
      console.warn('Failed to load text file content:', error);
      return null;
    }
  }

  // Helper function to extract text content from data URL
  private extractTextFromDataUrl(dataUrl: string): string | null {
    try {
      // Check if it's a text data URL (any text/* MIME type)
      const textDataUrlMatch = dataUrl.match(/^data:(text\/[^;]+);base64,(.+)$/);
      if (!textDataUrlMatch) {
        console.warn('Not a text data URL:', dataUrl.substring(0, 50) + '...');
        return null;
      }
      
      const [, mimeType, base64] = textDataUrlMatch;
      console.log('Extracting text from data URL with MIME type:', mimeType);
      
      // Decode base64 to text
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (error) {
      console.warn('Failed to extract text from data URL:', error);
      return null;
    }
  }
}
