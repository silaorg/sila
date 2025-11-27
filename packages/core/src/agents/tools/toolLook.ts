import {
  ChatAgent,
  LangMessage,
  LangMessages,
  type LangToolWithHandler,
  type LanguageProvider,
} from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import { resolveFileVertex } from "./workspaceProxyFetch";
import { AgentTool } from "./AgentTool";
import { AgentServices } from "@sila/core";

interface ImagePayload {
  base64: string;
  mimeType?: string;
  width?: number;
  height?: number;
  source: string;
}

function dataUrlToPayload(
  dataUrl: string,
  fallbackMime?: string,
): ImagePayload {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error(
      "Unsupported data URL format. Expected base64-encoded image data.",
    );
  }

  const [, mime, base64] = match;
  return {
    base64,
    mimeType: mime || fallbackMime,
    source: "data",
  };
}

async function fetchRemoteImage(uri: string): Promise<ImagePayload> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(
      `URI does not point to an image. Content-Type: ${
        contentType || "unknown"
      }`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const base64 = typeof Buffer !== "undefined"
    ? Buffer.from(bytes).toString("base64")
    : btoa(String.fromCharCode(...bytes));
  return {
    base64,
    mimeType: contentType,
    source: uri,
  };
}

async function resolveFileImage(
  space: Space,
  appTree: AppTree | undefined,
  uri: string,
): Promise<ImagePayload> {
  const resolver = space.fileResolver;
  const vertex = resolveFileVertex(uri, space, appTree);
  const treeId = uri.startsWith("file:///") ? space.getId() : appTree!.getId();

  const files = await resolver.getFileData([
    { tree: treeId, vertex: vertex.id },
  ]);
  const image = files.find((file) => file.kind === "image");

  if (!image) {
    throw new Error("File is not an image or could not be loaded.");
  }

  const payload = dataUrlToPayload(image.dataUrl, image.mimeType);
  return {
    ...payload,
    width: image.width,
    height: image.height,
    source: uri,
  };
}

async function resolveImageData(
  space: Space,
  appTree: AppTree | undefined,
  uri: string,
): Promise<ImagePayload> {
  if (uri.startsWith("file:")) {
    return await resolveFileImage(space, appTree, uri);
  }

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return await fetchRemoteImage(uri);
  }

  throw new Error("Unsupported URI scheme. Use http(s):// or file: paths.");
}

function buildLookInstructions(): string {
  return [
    "You are a vision assistant.",
    "Describe the visible content of the provided image succinctly and accurately.",
    "Do not fabricate details not visible in the image. Keep the response purely textual.",
  ].join("\n");
}

async function runLookAgent(
  lang: Promise<LanguageProvider>,
  prompt: string,
  image: ImagePayload,
): Promise<string> {
  const lookAgent = new ChatAgent(await lang);

  const items: Array<
    | { type: "text"; text: string }
    | {
      type: "image";
      base64: string;
      mimeType?: string;
      width?: number;
      height?: number;
      metadata?: Record<string, any>;
    }
  > = [
    { type: "text", text: prompt },
    {
      type: "image",
      base64: image.base64,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      metadata: { source: image.source },
    },
  ];

  const messages = new LangMessages([new LangMessage("user", items)]);
  messages.instructions = buildLookInstructions();

  const result = await lookAgent.run(messages);
  const assistant = [...result].reverse().find((msg) =>
    msg.role === "assistant"
  );

  if (!assistant) return "";

  if (assistant.text) {
    return assistant.text;
  }

  const textItem = Array.isArray((assistant as any).items)
    ? (assistant as any).items.find((item: any) => item?.type === "text")
    : null;

  return textItem?.text || "";
}

export const toolLook: AgentTool = {
  name: "look",
  description:
    "Inspect an image from a web URL or file: path and return a concise visual description. Use this to answer questions about attached or remote images.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Instruction for what to focus on when looking at the image.",
      },
      uri: {
        type: "string",
        description:
          "Resource URI to inspect. Supports http(s) URLs or file: paths (e.g., file:pic.jpg or file:///assets/pic.jpg).",
      },
    },
    required: ["prompt", "uri"],
  },
  getTool(services: AgentServices, appTree: AppTree) {
    return {
      name: this.name,
      description: this.description!,
      parameters: this.parameters!,
      handler: async (args: Record<string, any>): Promise<string> => {
        const uri = args.uri as string;
        const prompt =
          typeof args.prompt === "string" && args.prompt.trim().length > 0
            ? args.prompt.trim()
            : "Describe the visual content of the image.";

        if (!uri || typeof uri !== "string") {
          throw new Error("`uri` must be a non-empty string.");
        }

        const image = await resolveImageData(services.space, appTree, uri);
        // @TODO: figure out how to get an appropriate lang (with vision)
        const description = await runLookAgent(services.lang(), prompt, image);

        return description || "No description was generated.";
      },
    };
  },
};

/*
export function getToolLook(
  space: Space,
  appTree: AppTree | undefined,
  providerFactory: () => Promise<LanguageProvider>,
): LangToolWithHandler {
  return {
    name: "look",
    description:
      "Inspect an image from a web URL or file: path and return a concise visual description. Use this to answer questions about attached or remote images.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "Instruction for what to focus on when looking at the image.",
        },
        uri: {
          type: "string",
          description:
            "Resource URI to inspect. Supports http(s) URLs or file: paths (e.g., file:pic.jpg or file:///assets/pic.jpg).",
        },
      },
      required: ["prompt", "uri"],
    },
    handler: async (args: Record<string, any>): Promise<string> => {
      const uri = args.uri as string;
      const prompt =
        typeof args.prompt === "string" && args.prompt.trim().length > 0
          ? args.prompt.trim()
          : "Describe the visual content of the image.";

      if (!uri || typeof uri !== "string") {
        throw new Error("`uri` must be a non-empty string.");
      }

      const image = await resolveImageData(space, appTree, uri);
      const description = await runLookAgent(providerFactory, prompt, image);

      return description || "No description was generated.";
    },
  };
}
*/