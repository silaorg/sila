import { fal } from "@fal-ai/client";

export interface ImgToVideoOptions {
  prompt: string;
  image: string; // Single image URL or data URL (data URLs will be uploaded automatically)
  duration?: number; // Duration in seconds (will be clamped to 5s, 6s, 7s, or 8s - Veo2 only supports these)
  aspect_ratio?: "auto" | "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
  fps?: number; // Frames per second (e.g., 8, 16, 24) - may not be supported by Veo2
  motion_bucket_id?: number; // Motion intensity (1-255) - may not be supported by Veo2
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
    // Convert data URL to public URL if needed
    let imageUrl = options.image;
    
    // If the image is a data URL, upload it to Fal.ai storage to get a public URL
    if (imageUrl.startsWith("data:")) {
      try {
        // Extract base64 data from data URL
        const base64Data = imageUrl.split(",")[1];
        const mimeType = imageUrl.match(/data:([^;]+);/)?.[1] || "image/png";
        
        // Convert base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        
        // Upload to Fal.ai storage
        // Note: fal.storage.upload returns the URL directly as a string
        const uploadResult = await fal.storage.upload(blob, {
          contentType: mimeType,
        });
        
        // The upload result is the URL string itself, not an object
        if (typeof uploadResult === "string") {
          imageUrl = uploadResult;
        } else if (uploadResult && typeof uploadResult === "object" && "url" in uploadResult) {
          imageUrl = (uploadResult as any).url;
        } else {
          throw new Error(`Upload succeeded but returned unexpected format: ${JSON.stringify(uploadResult)}`);
        }
        
      } catch (error) {
        console.error("Failed to upload image to Fal.ai storage:", error);
        throw new Error(
          `Failed to upload image to Fal.ai storage: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Build input object - start with required parameters
    const input: any = {
      prompt: options.prompt,
      image_url: imageUrl, // Veo2 uses 'image_url' - must be a publicly accessible URL
    };

    // Add optional parameters if provided
    // Duration must be a string like "5s", "6s", "7s", or "8s" (Veo2 only supports these specific values)
    if (options.duration !== undefined) {
      const durationSeconds = options.duration;
      // Veo2 only supports 5s, 6s, 7s, or 8s - clamp to nearest supported value
      if (durationSeconds <= 5) {
        input.duration = "5s";
      } else if (durationSeconds <= 6) {
        input.duration = "6s";
      } else if (durationSeconds <= 7) {
        input.duration = "7s";
      } else {
        input.duration = "8s"; // Max supported duration (Veo2 limit)
      }
    }
    
    // Aspect ratio - Veo2 supports "auto" and specific ratios
    // Note: fps and motion_bucket_id may not be supported by Veo2 API
    if (options.aspect_ratio !== undefined) {
      input.aspect_ratio = options.aspect_ratio;
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Try to extract more detailed error information from Fal.ai API response
      let detailedError = errorMessage;
      if (error instanceof Error) {
        const err = error as any;
        // Check for Fal.ai API error format (from @fal-ai/client)
        if (err.body && Array.isArray(err.body.detail)) {
          // Extract validation errors from Fal.ai API
          const validationErrors = err.body.detail
            .map((d: any) => `${d.loc?.join(".")}: ${d.msg}`)
            .join(", ");
          if (validationErrors) {
            detailedError = `API validation error: ${validationErrors}`;
          }
        } else if (err.response?.data?.detail) {
          detailedError = `API Error: ${err.response.status} - ${JSON.stringify(err.response.data.detail)}`;
        }
      }
      
      if (options.onProgress) {
        options.onProgress({
          status: "FAILED",
          message: detailedError,
        });
      }
      throw new Error(detailedError);
    }
  }
}

