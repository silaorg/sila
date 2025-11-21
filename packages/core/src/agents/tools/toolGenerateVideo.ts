import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import { FileResolver } from "../../spaces/files/FileResolver";
import { FilesTreeData } from "../../spaces/files/FilesTreeData";
import { ImgToVideoGen } from "../../tools/falaiVideo";
import { resolvePath, ensureFileParent } from "./fileUtils";
import { ChatAppData } from "../../spaces/ChatAppData";

interface GenerateVideoResult {
  status: "completed" | "failed";
  message: string;
  files?: string[];
}

export function getToolGenerateVideo(
  space: Space,
  appTree?: AppTree
): LangToolWithHandler {
  return {
    name: "generate_video",
    description:
      "Generate a video from an image using AI. Accepts a file path to an input image and a prompt describing the desired animation. Returns the file path to the generated video. Use 'file:///assets/...' for workspace files or 'file:...' for chat files.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The prompt describing the desired animation or motion for the video.",
        },
        input_file: {
          type: "string",
          description:
            "File path (e.g., 'file:///assets/image.jpg' or 'file:image.jpg') to the image to animate. Required.",
        },
        output_path: {
          type: "string",
          description:
            "Optional file path where to save the generated video. If not provided, video will be saved with an auto-generated name in the chat files folder.",
        },
        duration: {
          type: "number",
          description: "Duration of the video in seconds. Default is 5 seconds.",
        },
        aspect_ratio: {
          type: "string",
          enum: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
          description: "Aspect ratio of the generated video. Default matches input image.",
        },
        fps: {
          type: "number",
          description: "Frames per second for the video. Default is 24.",
        },
        motion_intensity: {
          type: "number",
          description: "Motion intensity (1-255). Higher values create more motion. Default is automatic.",
        },
      },
      required: ["prompt", "input_file"],
    },
    handler: async (args: Record<string, any>): Promise<GenerateVideoResult> => {
      const prompt = args.prompt as string | undefined;
      const inputFile = args.input_file as string | undefined;
      const outputPath = args.output_path as string | undefined;
      const duration = args.duration as number | undefined;
      const aspectRatio = args.aspect_ratio as "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9" | undefined;
      const fps = args.fps as number | undefined;
      const motionIntensity = args.motion_intensity as number | undefined;

      if (!prompt || typeof prompt !== "string") {
        return {
          status: "failed",
          message: "Invalid prompt: must be a non-empty string",
        };
      }

      if (!inputFile || typeof inputFile !== "string" || !inputFile.startsWith("file:")) {
        return {
          status: "failed",
          message: "Invalid input_file: must be a file path starting with 'file:' or 'file:///'",
        };
      }

      // Get API key from space secrets
      const apiKey = space.getServiceApiKey("falai");
      if (!apiKey) {
        return {
          status: "failed",
          message: "Fal.ai API key not configured. Please configure Fal.ai in the provider settings.",
        };
      }

      try {
        const fileStore = space.getFileStore();
        if (!fileStore) {
          return {
            status: "failed",
            message: "FileStore is not available for this space",
          };
        }

        // Resolve input image
        const resolved = resolvePath(space, appTree, inputFile);
        if (!resolved.vertex) {
          return {
            status: "failed",
            message: `Input file not found: ${inputFile}`,
          };
        }

        // Check if it's an image file
        const mimeType = resolved.vertex.getProperty("mimeType") as string | undefined;
        if (!mimeType || !mimeType.startsWith("image/")) {
          return {
            status: "failed",
            message: `Input file is not an image: ${inputFile}`,
          };
        }

        // Get the tree ID (either space tree or app tree)
        const treeId = resolved.isWorkspace
          ? space.getId()
          : (appTree?.getId() || (await space.loadAppTree("chat"))?.getId());

        if (!treeId) {
          return {
            status: "failed",
            message: `Could not determine tree for file: ${inputFile}`,
          };
        }

        const resolver = new FileResolver(space);
        const fileRef = { tree: treeId, vertex: resolved.vertex.id };
        const resolvedFiles = await resolver.getFileData([fileRef]);
        const images = resolvedFiles.filter((f) => f.kind === "image");
        
        if (images.length === 0) {
          return {
            status: "failed",
            message: "Input file is not a valid image file",
          };
        }

        const imageData = images[0];
        if (!imageData.dataUrl) {
          return {
            status: "failed",
            message: "Could not retrieve image data from input file",
          };
        }

        // Generate video
        const videoGen = new ImgToVideoGen(apiKey);

        const result = await videoGen.generate({
          prompt,
          image: imageData.dataUrl,
          duration: duration ? Math.max(1, Math.min(duration, 60)) : undefined, // Limit between 1-60 seconds
          aspect_ratio: aspectRatio,
          fps: fps ? Math.max(8, Math.min(fps, 60)) : undefined, // Limit between 8-60 fps
          motion_bucket_id: motionIntensity ? Math.max(1, Math.min(motionIntensity, 255)) : undefined,
        });

        if (!result.url) {
          return {
            status: "failed",
            message: "No video URL returned from Fal.ai",
          };
        }

        // Download the generated video
        const response = await fetch(result.url);
        if (!response.ok) {
          throw new Error(`Failed to download generated video: ${response.status} ${response.statusText}`);
        }

        const videoBuffer = await response.arrayBuffer();
        const videoBytes = new Uint8Array(videoBuffer);

        const contentType = response.headers.get("content-type") || "video/mp4";
        const extension = contentType.split("/")[1] || "mp4";

        // Convert to data URL for storage
        let base64: string;
        if (typeof Buffer !== "undefined") {
          base64 = Buffer.from(videoBytes).toString("base64");
        } else {
          const binaryString = Array.from(videoBytes, (byte: number) => String.fromCharCode(byte)).join("");
          base64 = btoa(binaryString);
        }
        const dataUrl = `data:${contentType};base64,${base64}`;

        // Save to file store
        const put = await fileStore.putDataUrl(dataUrl);

        // Determine output path and create file vertex
        const targetTree = appTree || (await space.loadAppTree("chat"));
        if (!targetTree) {
          return {
            status: "failed",
            message: "Could not determine target app tree for saving generated video",
          };
        }

        // Create a temporary ChatAppData to use resolveFileTarget (ensures correct folder structure)
        const chatData = new ChatAppData(space, targetTree);
        const { targetTree: finalTree, parentFolder: defaultParentFolder } = await chatData.resolveFileTarget();

        const pathResolver = new FileResolver();
        pathResolver.setSpace(space);

        let parentFolder: any;
        let fileName: string;

        if (outputPath) {
          // Use provided output path
          if (!outputPath.startsWith("file:")) {
            return {
              status: "failed",
              message: `Invalid output path: ${outputPath}. Must start with 'file:' or 'file:///'`,
            };
          }

          // Ensure parent folder exists and get file name
          const { parent, name } = ensureFileParent(space, appTree, outputPath);
          parentFolder = parent;
          fileName = name;
        } else {
          // Auto-generate path in chat assets folder
          const timestamp = Date.now();
          fileName = `generated-video-${timestamp}.${extension}`;
          
          // Use the default parent folder from resolveFileTarget (ensures correct assets folder)
          parentFolder = defaultParentFolder;
        }

        // Create file vertex
        const fileVertex = FilesTreeData.saveFileInfo(parentFolder, {
          name: fileName,
          hash: put.hash,
          mimeType: contentType,
          size: videoBytes.length,
        });

        // Convert vertex to path
        // For chat files saved under assets, vertexToPath will return "file:assets/filename.mp4"
        // resolveChatPath can handle both "file:assets/filename.mp4" and "file:filename.mp4"
        // (it strips the "assets" prefix if present)
        const filePath = pathResolver.vertexToPath(fileVertex);

        return {
          status: "completed",
          message: `Successfully generated video (${result.duration || duration || 5}s)`,
          files: [filePath],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          status: "failed",
          message: `Error generating video: ${errorMessage}`,
        };
      }
    },
  };
}

