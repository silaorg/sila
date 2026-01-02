import { FilesTreeData } from "../../spaces/files/FilesTreeData";
import { ImgGen } from "../../tools/falai";
import { ensureFileParent } from "./fileUtils";
import { ChatAppData } from "../../spaces/ChatAppData";
import { bytesToDataUrl } from "../../spaces/files/dataUrl";
import type { AgentTool } from "./AgentTool";

interface GenerateImageResult {
  status: "completed" | "failed";
  message: string;
  files?: string[];
}

export const toolGenerateImage: AgentTool = {
  name: "generate_image",
  description:
    "Generate or edit images using AI. Accepts file paths to existing images (for editing) and a prompt. Returns file paths to the generated images. Use 'file:///assets/...' for workspace files or 'file:...' for chat files. When showing results to users, format images with previews: ![description](<file:///assets/file.jpg>).",
  canUseTool(services) {
    return Boolean(services.space.getServiceApiKey("falai"));
  },
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "The prompt describing what to generate or how to edit the images.",
      },
      input_files: {
        type: "array",
        items: {
          type: "string",
        },
        description:
          "Optional array of file paths (e.g., 'file:///assets/image.jpg' or 'file:image.jpg') to images to use as input for editing. If not provided, will generate a new image based on the prompt alone.",
      },
      output_path: {
        type: "string",
        description:
          "Optional file path where to save the generated image(s). If not provided or multiple images generated, images will be saved with auto-generated names in the chat files folder. For multiple images, base path will be used with numbered suffixes.",
      },
      num_images: {
        type: "number",
        description: "Number of images to generate. Default is 1, max is 4.",
      },
    },
    required: ["prompt"],
  },
  getTool(services, appTree) {
    const space = services.space;

    return {
      name: "generate_image",
      description: this.description!,
      parameters: this.parameters!,
      handler: async (
        args: Record<string, any>,
      ): Promise<GenerateImageResult> => {
        const prompt = args.prompt as string | undefined;
        const inputFiles = args.input_files as string[] | undefined;
        const outputPath = args.output_path as string | undefined;
        const numImages = args.num_images as number | undefined;

        if (!prompt || typeof prompt !== "string") {
          return {
            status: "failed",
            message: "Invalid prompt: must be a non-empty string",
          };
        }

        // Get API key from space secrets
        const apiKey = space.getServiceApiKey("falai");
        if (!apiKey) {
          return {
            status: "failed",
            message:
              "Fal.ai API key not configured. Please configure Fal.ai in the provider settings.",
          };
        }

        try {
          const fileStore = space.fileStore;
          if (!fileStore) {
            return {
              status: "failed",
              message: "FileStore is not available for this space",
            };
          }

          // Resolve input images if provided
          let imageUrls: string[] = [];
          if (
            inputFiles && Array.isArray(inputFiles) && inputFiles.length > 0
          ) {
            const resolver = space.fileResolver;
            const fileRefs: Array<{ tree: string; vertex: string }> = [];

            // Convert file paths to file references
            for (const filePath of inputFiles) {
              if (
                typeof filePath !== "string" || !filePath.startsWith("file:")
              ) {
                continue;
              }

              const isWorkspacePath = filePath.startsWith("file:///");

              let inputVertex;
              try {
                if (!isWorkspacePath && !appTree) {
                  return {
                    status: "failed",
                    message: "Chat file operations require a chat tree context",
                  };
                }

                const relativeRootVertex = isWorkspacePath
                  ? undefined
                  : appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);

                inputVertex = resolver.pathToVertex(
                  filePath,
                  relativeRootVertex,
                );
              } catch (error) {
                const errorMessage = error instanceof Error
                  ? error.message
                  : String(error);
                return {
                  status: "failed",
                  message:
                    `Input file not found: ${filePath} (${errorMessage})`,
                };
              }

              // Check if it's an image file
              const mimeType = inputVertex.getProperty("mimeType") as
                | string
                | undefined;
              if (!mimeType || !mimeType.startsWith("image/")) {
                return {
                  status: "failed",
                  message: `Input file is not an image: ${filePath}`,
                };
              }

              // Get the tree ID from the vertex's tree
              const treeId = isWorkspacePath
                ? space.getId()
                : (appTree?.getId() ||
                  (await space.loadAppTree("chat"))?.getId());

              if (!treeId) {
                return {
                  status: "failed",
                  message: `Could not determine tree for file: ${filePath}`,
                };
              }

              fileRefs.push({
                tree: treeId,
                vertex: inputVertex.id,
              });
            }

            if (fileRefs.length === 0) {
              return {
                status: "failed",
                message: "No valid image file paths provided",
              };
            }

            // Resolve file references to data URLs
            const resolvedFiles = await resolver.getFileData(fileRefs);
            const images = resolvedFiles.filter((f) => f.kind === "image");

            if (images.length === 0) {
              return {
                status: "failed",
                message:
                  "No valid image files found in the provided file paths",
              };
            }

            // Extract data URLs from resolved images
            imageUrls = images.map((img) => img.dataUrl).filter((
              url,
            ): url is string => !!url);

            // If input files were provided but none were valid, fail
            if (imageUrls.length === 0) {
              return {
                status: "failed",
                message:
                  "No valid image files found in the provided input_files. Please provide valid image file paths or omit input_files to generate a new image.",
              };
            }
          }

          // Initialize image generator
          const imgGen = new ImgGen(apiKey);

          // Generate images
          const generateOptions: any = {
            prompt,
            num_images: numImages ?? 1,
          };

          // Only include image parameter if images are provided
          if (imageUrls.length > 0) {
            generateOptions.image = imageUrls;
          }

          const result = await imgGen.generateFull(generateOptions);

          if (!result.urls || result.urls.length === 0) {
            return {
              status: "failed",
              message: "No images were generated",
            };
          }

          // Download generated images and save them to the file store
          const outputPaths: string[] = [];
          const targetTree = appTree || (await space.loadAppTree("chat"));

          if (!targetTree) {
            return {
              status: "failed",
              message:
                "Could not determine target app tree for saving generated images",
            };
          }

          // Create a temporary ChatAppData to use resolveFileTarget (ensures correct folder structure)
          const chatData = new ChatAppData(space, targetTree);
          const { targetTree: finalTree, parentFolder: defaultParentFolder } =
            await chatData.resolveFileTarget();

          const pathResolver = space.fileResolver;

          for (let i = 0; i < result.urls.length; i++) {
            const imageUrl = result.urls[i];

            // Download the image
            const response = await fetch(imageUrl);
            if (!response.ok) {
              console.error(
                `Failed to download generated image ${
                  i + 1
                }: ${response.status}`,
              );
              continue;
            }

            const imageBuffer = await response.arrayBuffer();
            const imageBytes = new Uint8Array(imageBuffer);

            // Determine MIME type from URL or response headers
            const contentType = response.headers.get("content-type") ||
              "image/png";
            const extension = contentType.split("/")[1] || "png";

            // Convert to data URL for storage
            const dataUrl = bytesToDataUrl(imageBytes, contentType);

            // Save to file store
            const put = await fileStore.putDataUrl(dataUrl);

            // Determine output path and create file vertex
            let parentFolder: any;
            let fileName: string;

            if (outputPath && i === 0 && result.urls.length === 1) {
              // Use provided output path for single image
              if (!outputPath.startsWith("file:")) {
                return {
                  status: "failed",
                  message:
                    `Invalid output path: ${outputPath}. Must start with 'file:' or 'file:///'`,
                };
              }

              // Ensure parent folder exists and get file name
              const { parent, name } = ensureFileParent(
                space,
                appTree,
                outputPath,
              );
              parentFolder = parent;
              fileName = name;
            } else if (outputPath && result.urls.length > 1) {
              // Multiple images: use output path as base and add suffix
              if (!outputPath.startsWith("file:")) {
                return {
                  status: "failed",
                  message:
                    `Invalid output path: ${outputPath}. Must start with 'file:' or 'file:///'`,
                };
              }

              const basePath = outputPath.replace(/\.[^.]+$/, ""); // Remove extension
              const ext = outputPath.match(/\.[^.]+$/)?.[0] || `.${extension}`;
              const finalPath = `${basePath}-${i + 1}${ext}`;

              const { parent, name } = ensureFileParent(
                space,
                appTree,
                finalPath,
              );
              parentFolder = parent;
              fileName = name;
            } else {
              // Auto-generate path in chat assets folder
              const timestamp = Date.now();
              fileName = `generated-image-${timestamp}-${i + 1}.${extension}`;

              // Use the default parent folder from resolveFileTarget (ensures correct assets folder)
              parentFolder = defaultParentFolder;
            }

            // Create file vertex
            const fileVertex = FilesTreeData.saveFileInfo(parentFolder, {
              name: fileName,
              hash: put.hash,
              mimeType: contentType,
              size: imageBytes.length,
            });

            // Convert vertex to path
            // For chat files saved under assets, vertexToPath will return "file:assets/filename.png"
            // resolveChatPath can handle both "file:assets/filename.png" and "file:filename.png"
            // (it strips the "assets" prefix if present)
            const filePath = pathResolver.vertexToPath(fileVertex);
            outputPaths.push(filePath);
          }

          if (outputPaths.length === 0) {
            return {
              status: "failed",
              message: "Failed to save generated images to the file store",
            };
          }

          return {
            status: "completed",
            message: `Successfully generated ${outputPaths.length} image(s)`,
            files: outputPaths,
          };
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : String(error);
          return {
            status: "failed",
            message: `Error generating images: ${errorMessage}`,
          };
        }
      },
    };
  },
};
