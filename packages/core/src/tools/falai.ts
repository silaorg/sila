import { fal } from "@fal-ai/client";

export interface ImgGenOptions {
  prompt: string;
  image: string | string[];
  num_images?: number;
  aspect_ratio?: "auto" | "21:9" | "16:9" | "3:2" | "4:3" | "5:4" | "1:1" | "4:5" | "3:4" | "2:3" | "9:16";
  output_format?: "jpeg" | "png" | "webp";
  resolution?: "1K" | "2K" | "4K";
  sync_mode?: boolean;
  onProgress?: (progress: ImgGenProgress) => void;
}

export interface ImgGenResult {
  /** URIs of the generated images; could be data URIs */
  urls: string[];
  /** Description of the generated images */
  description?: string;
}

export interface ImgGenProgress {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  message?: string;
  logs?: Array<{ message: string }>;
}

export class ImgGen {
  private readonly modelId = "fal-ai/nano-banana-pro/edit";
  
  constructor(readonly apiKey: string) {
    // Configure the Fal.ai client with the API key
    fal.config({
      credentials: apiKey,
    });
  }

  async generate(options: ImgGenOptions): Promise<string> {
    const result = await this.generateFull(options);
    return result.urls[0];
  }

  async generateFull(options: ImgGenOptions): Promise<ImgGenResult> {
    const imageUrls = Array.isArray(options.image) ? options.image : [options.image];
    
    const input = {
      prompt: options.prompt,
      image_urls: imageUrls,
      num_images: options.num_images ?? 1,
      aspect_ratio: options.aspect_ratio ?? "auto",
      output_format: options.output_format ?? "png",
      resolution: options.resolution ?? "1K",
      sync_mode: options.sync_mode ?? false,
    };

    try {
      const result = await fal.subscribe(this.modelId, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (options.onProgress) {
            // Map Fal.ai update status to our progress interface
            // Fal.ai QueueStatus only has: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED"
            let status: ImgGenProgress["status"] = update.status;

            // Extract logs safely - only available on IN_PROGRESS and COMPLETED
            const logs = 
              (update.status === "IN_PROGRESS" || update.status === "COMPLETED") && "logs" in update 
                ? update.logs?.map((log: any) => ({ message: log.message || String(log) }))
                : undefined;

            const message = 
              (update.status === "IN_PROGRESS" || update.status === "COMPLETED") && "logs" in update
                ? update.logs?.map((log: any) => log.message || String(log)).join(", ")
                : undefined;

            const progress: ImgGenProgress = {
              status,
              logs,
              message,
            };

            options.onProgress(progress);
          }

          // Log progress messages to console for debugging
          if (update.status === "IN_PROGRESS" && "logs" in update && update.logs) {
            update.logs.forEach((log: any) => {
              console.log(log.message || log);
            });
          }
        },
      });

      // Handle the result
      if (!result.data || !result.data.images || result.data.images.length === 0) {
        throw new Error("No images returned from Fal.ai");
      }

      const urls = result.data.images.map((img: any) => img.url);
      
      if (options.onProgress) {
        options.onProgress({
          status: "COMPLETED",
          message: "Image generation completed",
        });
      }

      return {
        urls,
        description: result.data.description,
      };
    } catch (error) {
      // Report failure to progress callback
      if (options.onProgress) {
        options.onProgress({
          status: "FAILED",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
      throw error;
    }
  }
}

