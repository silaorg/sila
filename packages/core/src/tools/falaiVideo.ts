import { fal } from "@fal-ai/client";

export interface ImgToVideoOptions {
  prompt: string;
  image: string; // Single image URL or data URL
  duration?: number; // Duration in seconds (e.g., 5)
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
  fps?: number; // Frames per second (e.g., 8, 16, 24)
  motion_bucket_id?: number; // Motion intensity (1-255)
  onProgress?: (progress: ImgToVideoProgress) => void;
}

export interface ImgToVideoResult {
  /** URL of the generated video */
  url: string;
  /** Duration of the video in seconds */
  duration?: number;
  /** Description of the generated video */
  description?: string;
}

export interface ImgToVideoProgress {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  message?: string;
  logs?: Array<{ message: string }>;
}

export class ImgToVideoGen {
  // Using Veo2 image-to-video model
  // Alternative: "fal-ai/vidu/q1/image-to-video"
  private readonly modelId = "fal-ai/veo2/image-to-video";
  
  constructor(readonly apiKey: string) {
    // Configure the Fal.ai client with the API key
    fal.config({
      credentials: apiKey,
    });
  }

  async generate(options: ImgToVideoOptions): Promise<ImgToVideoResult> {
    const input: any = {
      prompt: options.prompt,
      image_url: options.image,
    };

    // Add optional parameters if provided
    if (options.duration !== undefined) {
      input.duration = options.duration;
    }
    if (options.aspect_ratio !== undefined) {
      input.aspect_ratio = options.aspect_ratio;
    }
    if (options.fps !== undefined) {
      input.fps = options.fps;
    }
    if (options.motion_bucket_id !== undefined) {
      input.motion_bucket_id = options.motion_bucket_id;
    }

    try {
      const result = await fal.subscribe(this.modelId, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (options.onProgress) {
            // Map Fal.ai update status to our progress interface
            let status: ImgToVideoProgress["status"] = update.status;

            // Extract logs safely - only available on IN_PROGRESS and COMPLETED
            const logs = 
              (update.status === "IN_PROGRESS" || update.status === "COMPLETED") && "logs" in update 
                ? update.logs?.map((log: any) => ({ message: log.message || String(log) }))
                : undefined;

            const message = 
              (update.status === "IN_PROGRESS" || update.status === "COMPLETED") && "logs" in update
                ? update.logs?.map((log: any) => log.message || String(log)).join(", ")
                : undefined;

            const progress: ImgToVideoProgress = {
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
      if (!result.data || !result.data.video) {
        throw new Error("No video returned from Fal.ai");
      }

      const videoData = result.data.video;
      
      if (options.onProgress) {
        options.onProgress({
          status: "COMPLETED",
          message: "Video generation completed",
        });
      }

      return {
        url: videoData.url,
        duration: (videoData as any).duration || options.duration,
        description: (result.data as any).description,
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

