import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import { resolvePath } from "./fileUtils";
import { resolveWorkspaceFileUrl } from "./workspaceProxyFetch";
import type { FlowWorkerRequest, FlowWorkerResponse } from "./flowWorker";

interface RunFlowResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  result?: any;
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
      const resolved = resolvePath(space, appTree, path);
      
      if (!resolved.vertex) {
        throw new Error(`Flow file not found: ${path}`);
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

const FLOW_EXECUTION_TIMEOUT_MS = 60000 * 10; // 10 minutes

async function executeInWorker(code: string, args: string[]): Promise<RunFlowResult> {
  // Use web-worker polyfill if Worker is not available (e.g., in Node.js)
  const WorkerClass = typeof Worker !== "undefined" 
    ? Worker 
    : (await import("web-worker")).default;
  
  // Create worker
  const worker = new WorkerClass(
    new URL("./flowWorker.ts", import.meta.url),
    { type: "module" }
  );

  return new Promise((resolve, reject) => {
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
      
      if (response.success) {
        resolve({
          success: true,
          stdout: response.stdout,
          stderr: response.stderr,
          result: response.result,
        });
      } else {
        resolve({
          success: false,
          error: response.error || "Execution failed",
          stderr: response.stderr,
        });
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
      type: "run",
      code,
      args,
    };

    worker.postMessage(request);
  });
}

