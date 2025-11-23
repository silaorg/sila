import { fal } from "@fal-ai/client";

export interface ImgToVideoOptions {
  prompt: string;
  image: string; // Single image URL or data URL (data URLs will be uploaded automatically)
  duration?: number; // Duration in seconds (will be clamped to 4s, 6s, or 8s - Veo3 only supports these)
  aspect_ratio?: "auto" | "16:9" | "9:16" | "1:1";
  resolution?: "720p" | "1080p";
  generate_audio?: boolean; // Whether to generate audio for the video (default: true)
  onProgress?: (progress: VideoProgress) => void;
}

export interface TextToVideoOptions {
  prompt: string;
  duration?: number; // Duration in seconds (will be clamped to 4s, 6s, or 8s - Veo3 only supports these)
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  resolution?: "720p" | "1080p";
  negative_prompt?: string;
  enhance_prompt?: boolean; // Whether to enhance the video generation (default: true)
  auto_fix?: boolean; // Whether to automatically fix prompts that fail content policy (default: true)
  seed?: number;
  generate_audio?: boolean; // Whether to generate audio for the video (default: true)
  onProgress?: (progress: VideoProgress) => void;
}

export interface VideoResult {
  /** URL of the generated video */
  url: string;
  /** Duration of the video in seconds */
  duration?: number;
}

export interface VideoProgress {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  message?: string;
  logs?: Array<{ message: string }>;
}

export class ImgToVideoGen {
  // Using Veo3 image-to-video model
  private readonly modelId = "fal-ai/veo3/image-to-video";
  
  constructor(readonly apiKey: string) {
    // Configure the Fal.ai client with the API key
    fal.config({
      credentials: apiKey,
    });
  }

  async generate(options: ImgToVideoOptions): Promise<VideoResult> {
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
        // The blob already has the mimeType set, so no need to pass it separately
        const uploadResult = await fal.storage.upload(blob);
        
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
      image_url: imageUrl, // Veo3 uses 'image_url' - must be a publicly accessible URL
    };

    // Add optional parameters if provided
    // Duration must be a string like "4s", "6s", or "8s" (Veo3 only supports these specific values)
    if (options.duration !== undefined) {
      const durationSeconds = options.duration;
      // Veo3 only supports 4s, 6s, or 8s - clamp to nearest supported value
      if (durationSeconds <= 4) {
        input.duration = "4s";
      } else if (durationSeconds <= 6) {
        input.duration = "6s";
      } else {
        input.duration = "8s"; // Max supported duration (Veo3 limit)
      }
    }
    
    // Aspect ratio - Veo3 supports "auto", "9:16", "16:9", "1:1"
    if (options.aspect_ratio !== undefined) {
      input.aspect_ratio = options.aspect_ratio;
    }
    
    // Resolution - Veo3 supports "720p" or "1080p"
    if (options.resolution !== undefined) {
      input.resolution = options.resolution;
    }
    
    // Generate audio - default is true
    if (options.generate_audio !== undefined) {
      input.generate_audio = options.generate_audio;
    }
    

    try {
      const result = await fal.subscribe(this.modelId, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (options.onProgress) {
            // Map Fal.ai update status to our progress interface
            let status: VideoProgress["status"] = update.status;

            // Extract logs safely - only available on IN_PROGRESS and COMPLETED
            const logs = 
              (update.status === "IN_PROGRESS" || update.status === "COMPLETED") && "logs" in update 
                ? update.logs?.map((log: any) => ({ message: log.message || String(log) }))
                : undefined;

            const message = 
              (update.status === "IN_PROGRESS" || update.status === "COMPLETED") && "logs" in update
                ? update.logs?.map((log: any) => log.message || String(log)).join(", ")
                : undefined;

            const progress: VideoProgress = {
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

export class TextToVideoGen {
  // Using Veo3 text-to-video model
  private readonly modelId = "fal-ai/veo3";
  
  constructor(readonly apiKey: string) {
    // Configure the Fal.ai client with the API key
    fal.config({
      credentials: apiKey,
    });
  }

  async generate(options: TextToVideoOptions): Promise<VideoResult> {
    // Build input object - start with required parameters
    const input: any = {
      prompt: options.prompt,
    };

    // Add optional parameters if provided
    // Duration must be a string like "4s", "6s", or "8s" (Veo3 only supports these specific values)
    if (options.duration !== undefined) {
      const durationSeconds = options.duration;
      // Veo3 only supports 4s, 6s, or 8s - clamp to nearest supported value
      if (durationSeconds <= 4) {
        input.duration = "4s";
      } else if (durationSeconds <= 6) {
        input.duration = "6s";
      } else {
        input.duration = "8s"; // Max supported duration (Veo3 limit)
      }
    }
    
    // Aspect ratio - Veo3 supports "9:16", "16:9", "1:1"
    if (options.aspect_ratio !== undefined) {
      input.aspect_ratio = options.aspect_ratio;
    }
    
    // Resolution - Veo3 supports "720p" or "1080p"
    if (options.resolution !== undefined) {
      input.resolution = options.resolution;
    }
    
    // Negative prompt
    if (options.negative_prompt !== undefined) {
      input.negative_prompt = options.negative_prompt;
    }
    
    // Enhance prompt - default is true
    if (options.enhance_prompt !== undefined) {
      input.enhance_prompt = options.enhance_prompt;
    }
    
    // Auto fix - default is true
    if (options.auto_fix !== undefined) {
      input.auto_fix = options.auto_fix;
    }
    
    // Seed
    if (options.seed !== undefined) {
      input.seed = options.seed;
    }
    
    // Generate audio - default is true
    if (options.generate_audio !== undefined) {
      input.generate_audio = options.generate_audio;
    }

    try {
      const result = await fal.subscribe(this.modelId, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (options.onProgress) {
            // Map Fal.ai update status to our progress interface
            let status: VideoProgress["status"] = update.status;

            // Extract logs safely - only available on IN_PROGRESS and COMPLETED
            const logs = 
              (update.status === "IN_PROGRESS" || update.status === "COMPLETED") && "logs" in update 
                ? update.logs?.map((log: any) => ({ message: log.message || String(log) }))
                : undefined;

            const message = 
              (update.status === "IN_PROGRESS" || update.status === "COMPLETED") && "logs" in update
                ? update.logs?.map((log: any) => log.message || String(log)).join(", ")
                : undefined;

            const progress: VideoProgress = {
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

