import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import { FileResolver } from "../../spaces/files/FileResolver";
import { ChatAppData } from "../../spaces/ChatAppData";
import { resolveWorkspaceFileUrl } from "./workspaceProxyFetch";
import type { FlowWorkerRequest, FlowWorkerResponse } from "./flowWorker";

interface RunFlowResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  result?: any;
  outputs?: Record<string, any>;
  error?: string;
}

export function getToolRunFlow(space: Space, appTree?: AppTree): LangToolWithHandler {
  return {
    name: "run_flow",
    description:
      "Execute a JavaScript flow file (.flow.js) from the workspace. The file will be executed in a sandboxed environment with limited resources.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Path to the .flow.js file. Use 'file:' for chat files (e.g. file:flows/test.flow.js) or 'file:///assets/...' for workspace assets.",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Optional arguments to pass to the flow script (accessible via process.argv in the script).",
        },
      },
      required: ["path"],
    },
    handler: async (args: Record<string, any>): Promise<RunFlowResult> => {
      const { path, args: scriptArgs = [] } = args;
      
      if (typeof path !== "string" || !path.startsWith("file:")) {
        throw new Error(
          "run_flow tool only supports file: URIs. For example: file:flows/test.flow.js or file:///assets/flows/test.flow.js"
        );
      }

      // Resolve the file path
      const resolver = new FileResolver(space);
      const isWorkspacePath = path.startsWith("file:///");
      
      let flowVertex;
      try {
        if (!isWorkspacePath && !appTree) {
          throw new Error("Chat file operations require a chat tree context");
        }
        
        const relativeRootVertex = isWorkspacePath 
          ? undefined 
          : appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);
        
        flowVertex = resolver.pathToVertex(path, relativeRootVertex);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Flow file not found: ${path} (${errorMessage})`);
      }

      // Check if it's a .flow.js file
      if (!path.endsWith(".flow.js") && !path.endsWith(".flow.mjs")) {
        throw new Error(`File must be a .flow.js or .flow.mjs file: ${path}`);
      }

      // Read the file content using the workspace file resolver
      const code = await resolveWorkspaceFileUrl(path, space, appTree);

      // Execute in worker
      return await executeInWorker(code, scriptArgs);
    },
  };
}

export function getToolTestFlow(space: Space, appTree?: AppTree): LangToolWithHandler {
  return {
    name: "test_flow",
    description:
      "Execute a JavaScript flow file (.flow.js) using simulated services. Useful for validating inputs/outputs before real services exist.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Path to the .flow.js file. Use 'file:' for chat files (e.g. file:flows/test.flow.js) or 'file:///assets/...' for workspace assets.",
        },
        inputs: {
          type: "object",
          additionalProperties: true,
          description: "Optional map of sample inputs keyed by input id.",
        },
      },
      required: ["path"],
    },
    handler: async (args: Record<string, any>): Promise<RunFlowResult> => {
      const { path, inputs = {} } = args;

      if (typeof path !== "string" || !path.startsWith("file:")) {
        throw new Error(
          "test_flow tool only supports file: URIs. For example: file:flows/test.flow.js or file:///assets/flows/test.flow.js"
        );
      }

      const resolver = new FileResolver(space);
      const isWorkspacePath = path.startsWith("file:///");
      
      let flowVertex;
      try {
        if (!isWorkspacePath && !appTree) {
          throw new Error("Chat file operations require a chat tree context");
        }
        
        const relativeRootVertex = isWorkspacePath 
          ? undefined 
          : appTree!.tree.getVertexByPath(ChatAppData.ASSETS_ROOT_PATH);
        
        flowVertex = resolver.pathToVertex(path, relativeRootVertex);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Flow file not found: ${path} (${errorMessage})`);
      }

      if (!path.endsWith(".flow.js") && !path.endsWith(".flow.mjs")) {
        throw new Error(`File must be a .flow.js or .flow.mjs file: ${path}`);
      }

      const code = await resolveWorkspaceFileUrl(path, space, appTree);
      return await runFlowWithServices(code, TEST_SERVICE_DESCRIPTORS, space, appTree, inputs);
    },
  };
}
  
export const TEST_SERVICE_DESCRIPTORS = {
  img: { simulate: "img" },
  agent: { simulate: "agent" }
};

const FLOW_EXECUTION_TIMEOUT_MS = 60000 * 10; // 10 minutes

export interface InspectFlowResult {
  success: boolean;
  metadata?: {
    description?: string;
    inputs?: Array<{ id: string; type: string; label: string }>;
  };
  error?: string;
}

/**
 * Inspect a flow file to extract metadata (description, inputs) without executing run().
 */
export async function inspectFlow(
  code: string,
  space: Space,
  appTree?: AppTree
): Promise<InspectFlowResult> {
  return await executeInWorker(code, [], "inspect");
}

/**
 * Execute a flow file with services, calling the run() function.
 * 
 * Note: Services must be serializable (no functions). For functions,
 * use a service registry pattern or pass service descriptors.
 */
export async function runFlowWithServices(
  code: string,
  services: any,
  space: Space,
  appTree?: AppTree,
  inputs?: Record<string, any>
): Promise<RunFlowResult> {
  // For now, we'll pass services as-is, but they need to be serializable
  // In the future, we'll use a service registry
  return await executeInWorker(code, [], "run", services, inputs);
}

async function executeInWorker(
  code: string,
  args: string[],
  mode: "run" | "inspect" = "run",
  services?: any,
  inputs?: Record<string, any>
): Promise<RunFlowResult | InspectFlowResult> {
  // Use web-worker polyfill if Worker is not available (e.g., in Node.js)
  const WorkerClass = typeof Worker !== "undefined" 
    ? Worker 
    : (await import("web-worker")).default;
  
  // Create worker
  const worker = new WorkerClass(
    new URL("./flowWorker.ts", import.meta.url),
    { type: "module" }
  );

  return new Promise<RunFlowResult | InspectFlowResult>((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Flow execution timeout (${FLOW_EXECUTION_TIMEOUT_MS / 1000} seconds)`));
    }, FLOW_EXECUTION_TIMEOUT_MS); // 

    const messageHandler = (e: MessageEvent<FlowWorkerResponse>) => {
      if (e.data.requestId !== requestId) {
        return; // Ignore messages for other requests
      }

      clearTimeout(timeout);
      worker.removeEventListener("message", messageHandler);
      worker.terminate();

      const response = e.data;
      
      if (response.type === "inspect") {
        // Return inspect result
        resolve({
          success: response.success,
          metadata: response.metadata,
          error: response.error,
        } as InspectFlowResult);
        } else {
          // Return run result
          if (response.success) {
            resolve({
              success: true,
              stdout: response.stdout,
              stderr: response.stderr,
              result: response.result,
              outputs: response.outputs,
            } as RunFlowResult);
          } else {
            resolve({
              success: false,
              error: response.error || "Execution failed",
              stderr: response.stderr,
            } as RunFlowResult);
          }
      }
    };

    worker.addEventListener("message", messageHandler);

    worker.addEventListener("error", (error) => {
      clearTimeout(timeout);
      worker.removeEventListener("message", messageHandler);
      worker.terminate();
      reject(new Error(`Worker error: ${error.message}`));
    });

    // Send execution request
    const request: FlowWorkerRequest = {
      requestId,
      type: mode,
      code,
      args,
      services,
      inputs,
    };

    worker.postMessage(request);
  });
}

