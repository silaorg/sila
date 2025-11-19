import { getQuickJS, type QuickJSContext, type QuickJSRuntime, type QuickJSHandle } from "quickjs-emscripten";

// Message protocol between main thread and worker
export interface FlowWorkerRequest {
  requestId: string;
  type: "run" | "lint";
  code?: string; // For run requests
  path?: string; // For lint requests (future)
  args?: string[]; // For run requests
}

export interface FlowWorkerResponse {
  requestId: string;
  type: "run" | "lint";
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  result?: any; // Execution result
  diagnostics?: any[]; // Lint diagnostics (future)
}

// QuickJS initialization (inlined from flowExecutor to avoid module resolution issues in workers)
let quickJSRuntime: QuickJSRuntime | null = null;
let quickJSContext: QuickJSContext | null = null;

async function initQuickJS(): Promise<{ runtime: QuickJSRuntime; context: QuickJSContext }> {
  if (quickJSRuntime && quickJSContext) {
    return { runtime: quickJSRuntime, context: quickJSContext };
  }

  const QuickJS = await getQuickJS();
  quickJSRuntime = QuickJS.newRuntime();
  
  // Set memory and time limits
  quickJSRuntime.setMemoryLimit(1024 * 1024 * 10); // 10MB limit
  quickJSRuntime.setMaxStackSize(1024 * 1024); // 1MB stack
  
  quickJSContext = quickJSRuntime.newContext();
  
  return { runtime: quickJSRuntime, context: quickJSContext };
}

async function executeFlowCode(code: string, args: string[] = []): Promise<{ success: boolean; stdout?: string; stderr?: string; result?: any; error?: string }> {
  try {
    const { context } = await initQuickJS();
    
    if (!code) {
      return {
        success: false,
        error: "No code provided for execution"
      };
    }

    // Capture console.log output
    let stdout = "";
    let stderr = "";
    
    // Create console object with log and error methods
    const consoleObj = context.newObject();
    
    // Create log function that captures output
    const consoleLog = context.newFunction("log", (...args: QuickJSHandle[]) => {
      const parts: string[] = [];
      for (const arg of args) {
        try {
          const str = context.getString(arg);
          parts.push(str);
        } catch {
          // If not a string, try to convert
          try {
            const json = context.dump(arg);
            const val = json.consume((v: unknown) => {
              if (typeof v === "string") return v;
              if (typeof v === "number" || typeof v === "boolean") return String(v);
              if (v === null) return "null";
              return JSON.stringify(v);
            });
            parts.push(val);
          } catch {
            parts.push("[object]");
          }
        }
      }
      stdout += parts.join(" ") + "\n";
      return context.undefined;
    });
    
    // Create error function
    const consoleError = context.newFunction("error", (...args: QuickJSHandle[]) => {
      const parts: string[] = [];
      for (const arg of args) {
        try {
          const str = context.getString(arg);
          parts.push(str);
        } catch {
          try {
            const json = context.dump(arg);
            const val = json.consume((v: unknown) => {
              if (typeof v === "string") return v;
              if (typeof v === "number" || typeof v === "boolean") return String(v);
              if (v === null) return "null";
              return JSON.stringify(v);
            });
            parts.push(val);
          } catch {
            parts.push("[object]");
          }
        }
      }
      stderr += parts.join(" ") + "\n";
      return context.undefined;
    });

    context.setProp(consoleObj, "log", consoleLog);
    context.setProp(consoleObj, "error", consoleError);
    context.setProp(context.global, "console", consoleObj);

    // Execute the code
    const result = context.evalCode(code, "<flow>");
    
    let resultValue: any = undefined;
    if (result.error) {
      const errorHandle = result.error;
      try {
        const errorMessage = context.getString(errorHandle);
        stderr += errorMessage + "\n";
      } catch {
        // Try to get error message another way
        try {
          const json = context.dump(errorHandle);
          const msg = json.consume((v: unknown) => String(v));
          stderr += msg + "\n";
        } catch {
          stderr += "Execution error\n";
        }
      }
      errorHandle.dispose();
    } else {
      if (result.value) {
        const valueHandle = result.value;
        // Try to serialize the result
        try {
          // First try to get as number/string directly
          try {
            const num = context.getNumber(valueHandle);
            resultValue = num;
            valueHandle.dispose();
          } catch {
            try {
              const str = context.getString(valueHandle);
              resultValue = str;
              valueHandle.dispose();
            } catch {
              // Try JSON dump for other types
              const json = context.dump(valueHandle);
              resultValue = json.consume((val: unknown) => {
                // Convert to JSON-serializable format
                if (typeof val === "string" || typeof val === "number" || typeof val === "boolean" || val === null) {
                  return val;
                }
                return String(val);
              });
              valueHandle.dispose();
            }
          }
        } catch (e) {
          resultValue = undefined;
          valueHandle.dispose();
        }
      }
    }

    // Cleanup
    consoleLog.dispose();
    consoleError.dispose();
    consoleObj.dispose();

    return {
      success: !result.error,
      stdout: stdout.trim() || undefined,
      stderr: stderr.trim() || undefined,
      result: resultValue,
      error: result.error ? stderr : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function handleRunRequest(request: FlowWorkerRequest): Promise<FlowWorkerResponse> {
  if (!request.code) {
    return {
      requestId: request.requestId,
      type: "run",
      success: false,
      error: "No code provided for execution"
    };
  }

  const executionResult = await executeFlowCode(request.code, request.args || []);
  
  return {
    requestId: request.requestId,
    type: "run",
    ...executionResult
  };
}

async function handleLintRequest(request: FlowWorkerRequest): Promise<FlowWorkerResponse> {
  // TODO: Implement ESLint WASM integration
  return {
    requestId: request.requestId,
    type: "lint",
    success: true,
    diagnostics: []
  };
}

// Worker message handler
self.onmessage = async (e: MessageEvent<FlowWorkerRequest>) => {
  const request = e.data;
  
  let response: FlowWorkerResponse;
  
  try {
    if (request.type === "run") {
      response = await handleRunRequest(request);
    } else if (request.type === "lint") {
      response = await handleLintRequest(request);
    } else {
      response = {
        requestId: request.requestId,
        type: request.type,
        success: false,
        error: `Unknown request type: ${request.type}`
      };
    }
  } catch (error) {
    response = {
      requestId: request.requestId,
      type: request.type,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  
  self.postMessage(response);
};

