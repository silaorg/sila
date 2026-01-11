import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import { ensureFileParent, inferTextMimeFromPath, validateTextMimeType } from "./fileUtils";
import type { AgentTool } from "./AgentTool";

interface WriteToFileResult {
  status: "completed" | "failed";
  output: string;
}

function buildToolWriteToFile(
  space: Space,
  appTree: AppTree | undefined,
  description?: string,
  parameters?: LangToolWithHandler["parameters"]
): LangToolWithHandler {
  return {
    name: "write_to_file",
    description: description || "Write full content to a file. If the file exists, it will be overwritten. If not, it will be created.",
    parameters: parameters ?? {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path to the file to write. Can be a workspace path (e.g. 'file:///assets/brand.md') or a chat path (e.g. 'file:notes.md' or just 'notes.md')."
        },
        content: {
          type: "string",
          description: "The full content to write to the file."
        }
      },
      required: ["path", "content"]
    },
    handler: async (args: Record<string, any>): Promise<WriteToFileResult> => {
      const path = args.path as string | undefined;
      const content = args.content as string | undefined;

      if (!path || typeof path !== "string") {
        return {
          status: "failed",
          output: "Invalid path: must be a non-empty string",
        };
      }

      if (typeof content !== "string") {
        return {
          status: "failed",
          output: "Invalid content: must be a string",
        };
      }

      // Normalize path to always have file: prefix if missing
      let uri = path;
      if (!uri.startsWith("file:") && !uri.startsWith("/")) {
        uri = `file:${uri}`;
      } else if (uri.startsWith("/")) {
        // Assume workspace absolute path if starts with /? Or forbid?
        // The previous implementation fell back to workspace path if starts with /.
        // Let's align with fileUtils which requires file:.
        // However, user might just pass "/assets/foo".
        // I'll stick to previous logic: prepend file:/// if starts with /, or file: if not.
        if (uri.startsWith("/")) {
          uri = `file://${uri}`;
        } else if (!uri.startsWith("file:")) {
          uri = `file:${uri}`;
        }
      }

      try {
        await handleWrite(space, appTree, uri, content);
        return {
          status: "completed",
          output: `Successfully wrote to ${path}`,
        };
      } catch (error: any) {
        return {
          status: "failed",
          output: `Error: ${error?.message ?? String(error)}`,
        };
      }
    },
  };
}

export const toolWriteToFile: AgentTool = {
  name: "write_to_file",
  description: "Write full content to a file. If the file exists, it will be overwritten. If not, it will be created.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the file to write. Can be a workspace path (e.g. 'file:///assets/brand.md') or a chat path (e.g. 'file:notes.md' or just 'notes.md')."
      },
      content: {
        type: "string",
        description: "The full content to write to the file."
      }
    },
    required: ["path", "content"]
  },
  getTool(services, appTree) {
    return buildToolWriteToFile(services.space, appTree, this.description, this.parameters);
  },
};

async function handleWrite(
  space: Space,
  appTree: AppTree | undefined,
  uri: string,
  content: string
): Promise<void> {
  const store = space.fileStore;
  if (!store) {
    throw new Error("write_to_file: FileStore is not configured for this space");
  }

  // This ensures parent folders exist and returns the parent + filename
  const { parent, name } = ensureFileParent(space, appTree, uri);
  
  const existingVertex = parent.children?.find(c => c.name === name);

  const bytes = new TextEncoder().encode(content);
  
  let mimeType = existingVertex?.getProperty("mimeType") as string | undefined;
  const inferredMime = mimeType || inferTextMimeFromPath(name) || "text/plain";

  // Only allow text-like files
  validateTextMimeType(inferredMime);

  const mutableId = crypto.randomUUID();
  
  // Write content into mutable storage
  await store.putMutable(mutableId, bytes);

  if (existingVertex) {
    // Update existing file vertex
    const existingHash = (existingVertex.getProperty("hash") as string | undefined)?.trim();
    if (existingHash) {
      // Preserve original immutable hash separately for reference if needed
      existingVertex.setProperty("originalHash", existingHash);
    }
    existingVertex.setProperty("id", mutableId);
    existingVertex.setProperty("mimeType", inferredMime);
    existingVertex.setProperty("size", bytes.byteLength);
    existingVertex.setProperty("updatedAt", Date.now());
  } else {
    // Create new file vertex
    parent.newNamedChild(name, {
      name: name,
      id: mutableId,
      mimeType: inferredMime,
      size: bytes.byteLength,
      updatedAt: Date.now(),
    });
  }
}
