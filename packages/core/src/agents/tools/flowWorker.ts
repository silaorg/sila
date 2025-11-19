import { getQuickJS, newAsyncContext, type QuickJSAsyncContext, type QuickJSAsyncRuntime, type QuickJSHandle } from "quickjs-emscripten";

// Message protocol between main thread and worker
export interface FlowWorkerRequest {
  requestId: string;
  type: "run" | "lint" | "inspect";
  code?: string; // For run/inspect requests
  path?: string; // For lint requests (future)
  args?: string[]; // For run requests
  services?: any; // Services descriptor for run requests (serializable, not functions)
  // Note: Functions can't be passed through postMessage, so services must be
  // described as data that the worker can use to create service functions
}

export interface FlowWorkerResponse {
  requestId: string;
  type: "run" | "lint" | "inspect";
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  result?: any; // Execution result
  metadata?: { // For inspect responses
    description?: string;
    inputs?: Array<{ id: string; type: string; label: string }>;
  };
  diagnostics?: any[]; // Lint diagnostics (future)
}

// QuickJS async runtime initialization (supports async/await natively)
let quickJSRuntime: QuickJSAsyncRuntime | null = null;
let quickJSContext: QuickJSAsyncContext | null = null;

async function initQuickJS(): Promise<{ runtime: QuickJSAsyncRuntime; context: QuickJSAsyncContext }> {
  if (quickJSRuntime && quickJSContext) {
    return { runtime: quickJSRuntime, context: quickJSContext };
  }

  // Use async runtime for native async/await support
  quickJSContext = await newAsyncContext();
  quickJSRuntime = quickJSContext.runtime;
  
  // Set memory and time limits
  quickJSRuntime.setMemoryLimit(1024 * 1024 * 10); // 10MB limit
  quickJSRuntime.setMaxStackSize(1024 * 1024); // 1MB stack
  
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

    // Execute the code (async runtime supports async/await)
    const result = await context.evalCodeAsync(code, "<flow>");
    
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

/**
 * Inspect flow code to extract metadata (description, inputs) without executing run().
 * 
 * Expected API pattern:
 * ```js
 * const { inImg, inText, describe } = pipeline;
 * 
 * describe("Pipeline description");
 * const imgA = inImg("img-a", "Label for image A");
 * const textB = inText("text-b", "Label for text B");
 * 
 * async function run(services) {
 *   // Implementation
 * }
 * ```
 */
async function handleInspectRequest(request: FlowWorkerRequest): Promise<FlowWorkerResponse> {
  if (!request.code) {
    return {
      requestId: request.requestId,
      type: "inspect",
      success: false,
      error: "No code provided for inspection"
    };
  }

  try {
    const { context } = await initQuickJS();
    
    // Track metadata during execution
    let description: string | undefined;
    const inputs: Array<{ id: string; type: string; label: string }> = [];
    
    // Create pipeline API that tracks metadata
    const pipelineModule = context.newObject();
    
    // describe() function
    const describeFn = context.newFunction("describe", (descHandle: QuickJSHandle) => {
      try {
        description = context.getString(descHandle);
      } catch {
        // Ignore if not a string
      }
      return context.undefined;
    });
    context.setProp(pipelineModule, "describe", describeFn);
    
    // inImg() function
    const inImgFn = context.newFunction("inImg", (idHandle: QuickJSHandle, labelHandle: QuickJSHandle) => {
      try {
        const id = context.getString(idHandle);
        const label = context.getString(labelHandle);
        inputs.push({ id, type: "image", label });
        // Return a placeholder object
        const placeholder = context.newObject();
        context.setProp(placeholder, "id", context.newString(id));
        context.setProp(placeholder, "type", context.newString("image"));
        return placeholder;
      } catch {
        return context.undefined;
      }
    });
    context.setProp(pipelineModule, "inImg", inImgFn);
    
    // inText() function
    const inTextFn = context.newFunction("inText", (idHandle: QuickJSHandle, labelHandle: QuickJSHandle) => {
      try {
        const id = context.getString(idHandle);
        const label = context.getString(labelHandle);
        inputs.push({ id, type: "text", label });
        const placeholder = context.newObject();
        context.setProp(placeholder, "id", context.newString(id));
        context.setProp(placeholder, "type", context.newString("text"));
        return placeholder;
      } catch {
        return context.undefined;
      }
    });
    context.setProp(pipelineModule, "inText", inTextFn);
    
    // Create module system - inject "pipeline" module
    const moduleSystem = context.newObject();
    context.setProp(moduleSystem, "pipeline", pipelineModule);
    
    // Inject pipeline as global - no transformation needed
    // Users write: const { inImg, describe } = pipeline;
    context.setProp(context.global, "pipeline", pipelineModule);
    
    // Execute code to extract metadata (but don't call run())
    // The code will define inputs/description, but run() won't be called
    const result = await context.evalCodeAsync(request.code, "<flow-inspect>");
    
    // Cleanup
    describeFn.dispose();
    inImgFn.dispose();
    inTextFn.dispose();
    pipelineModule.dispose();
    moduleSystem.dispose();
    
    if (result.error) {
      const errorHandle = result.error;
      let errorMsg = "Inspection error";
      try {
        errorMsg = context.getString(errorHandle);
      } catch {
        try {
          const json = context.dump(errorHandle);
          errorMsg = json.consume((v: unknown) => String(v));
        } catch {}
      }
      errorHandle.dispose();
      
      return {
        requestId: request.requestId,
        type: "inspect",
        success: false,
        error: errorMsg
      };
    }
    
    if (result.value) {
      result.value.dispose();
    }
    
    return {
      requestId: request.requestId,
      type: "inspect",
      success: true,
      metadata: {
        description,
        inputs
      }
    };
  } catch (error) {
    return {
      requestId: request.requestId,
      type: "inspect",
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

  // If services are provided, execute with services (pipeline mode)
  if (request.services) {
    const result = await executeFlowCodeWithServices(request.code, request.services);
    result.requestId = request.requestId;
    return result;
  }

  // Otherwise, simple execution
  const executionResult = await executeFlowCode(request.code, request.args || []);
  
  return {
    requestId: request.requestId,
    type: "run",
    ...executionResult
  };
}

/**
 * Execute flow code with services, calling the exported run() function.
 * 
 * Expected API pattern:
 * ```js
 * const { inImg, inText, describe } = pipeline;
 * 
 * describe("Pipeline description");
 * const imgA = inImg("img-a", "Label");
 * 
 * async function run(services) {
 *   const result = await services.img([imgA], "prompt");
 *   return result[0];
 * }
 * ```
 */
// Global service registry (in worker context)
// Services are registered here and can be accessed by name
const serviceRegistry = new Map<string, Function>();

async function executeFlowCodeWithServices(code: string, servicesDescriptor: any): Promise<FlowWorkerResponse> {
  try {
    const { context } = await initQuickJS();
    
    // No transformation needed - pipeline API is injected as global
    // Users write plain JavaScript using the global `pipeline` object
    const transformedCode = code;
    
    // Inject pipeline API (same as inspect, but also provide services)
    const pipelineModule = context.newObject();
    const inputs: Array<{ id: string; value: any }> = [];
    
    // describe() function
    const describeFn = context.newFunction("describe", () => context.undefined);
    context.setProp(pipelineModule, "describe", describeFn);
    
    // inImg() - returns placeholder that will be replaced with actual values
    const inImgFn = context.newFunction("inImg", (idHandle: QuickJSHandle, labelHandle: QuickJSHandle) => {
      try {
        const id = context.getString(idHandle);
        const placeholder = context.newObject();
        context.setProp(placeholder, "id", context.newString(id));
        context.setProp(placeholder, "type", context.newString("image"));
        // Store reference to replace later
        inputs.push({ id, value: placeholder });
        return placeholder;
      } catch {
        return context.undefined;
      }
    });
    context.setProp(pipelineModule, "inImg", inImgFn);
    
    // inText() - same as inImg
    const inTextFn = context.newFunction("inText", (idHandle: QuickJSHandle, labelHandle: QuickJSHandle) => {
      try {
        const id = context.getString(idHandle);
        const placeholder = context.newObject();
        context.setProp(placeholder, "id", context.newString(id));
        context.setProp(placeholder, "type", context.newString("text"));
        inputs.push({ id, value: placeholder });
        return placeholder;
      } catch {
        return context.undefined;
      }
    });
    context.setProp(pipelineModule, "inText", inTextFn);
    
    // Helper to create mock services from descriptors
    function createMockService(name: string, descriptor: any): Function {
      // For testing: create a simple mock that returns descriptor.returns or a default
      return async (...args: any[]) => {
        console.log(`[DEBUG] createMockService(${name}) called with args:`, JSON.stringify(args));
        console.log(`[DEBUG] createMockService(${name}) descriptor:`, JSON.stringify(descriptor));
        if (descriptor && descriptor.returns) {
          console.log(`[DEBUG] createMockService(${name}) returning:`, JSON.stringify(descriptor.returns));
          return descriptor.returns;
        }
        // Default mock behavior
        const defaultReturn = { service: name, args, mock: true };
        console.log(`[DEBUG] createMockService(${name}) returning default:`, JSON.stringify(defaultReturn));
        return defaultReturn;
      };
    }
    
    // Inject services object - create QuickJS functions that call registered services
    const servicesObj = context.newObject();
    
    // Services are passed as descriptors (e.g., { processImage: { type: "mock", returns: {...} } })
    // For v1, we'll create simple mock services based on descriptors
    // In the future, services will be registered in a global registry
    if (servicesDescriptor && typeof servicesDescriptor === "object") {
      for (const [key, descriptor] of Object.entries(servicesDescriptor)) {
        // Create a service function based on the descriptor
        // For now, if descriptor is a function (from registry), use it
        // Otherwise, create a mock based on descriptor
        const serviceImpl = typeof descriptor === "function" 
          ? descriptor 
          : serviceRegistry.get(key) || createMockService(key, descriptor);
          
        // Helper to convert JavaScript value to QuickJS handle
        const convertToQuickJSHandle = async (value: any): Promise<QuickJSHandle> => {
          if (value === undefined || value === null) {
            return context.undefined;
          } else if (typeof value === "string") {
            return context.newString(value);
          } else if (typeof value === "number") {
            return context.newNumber(value);
          } else if (typeof value === "boolean") {
            return value ? context.true : context.false;
          } else {
            // For objects, use JSON
            const jsonStr = JSON.stringify(value);
            const parsed = await context.evalCodeAsync(`JSON.parse(${JSON.stringify(jsonStr)})`, "<service-result>");
            if (parsed.error) {
              parsed.error.dispose();
              return context.undefined;
            }
            return parsed.value || context.undefined;
          }
        };
        
        // Create async function that calls the service and returns a Promise
        // Async runtime supports async/await natively via newAsyncifiedFunction
        const serviceFn = context.newAsyncifiedFunction(key, async (...args: QuickJSHandle[]) => {
          // Convert QuickJS handles to JavaScript values
          const jsArgs = args.map(arg => {
            try {
              const json = context.dump(arg);
              return json.consume((v: unknown) => v);
            } catch {
              return undefined;
            }
          });
          
          console.log(`[DEBUG] Service ${key} called with args:`, JSON.stringify(jsArgs));
          
          // Call the service function (which may be async)
          const result = await Promise.resolve(serviceImpl(...jsArgs));
          
          console.log(`[DEBUG] Service ${key} returned:`, JSON.stringify(result));
          
          // Convert result back to QuickJS handle
          const handle = await convertToQuickJSHandle(result);
          console.log(`[DEBUG] Service ${key} converted to handle, type:`, typeof handle);
          return handle;
        });
        context.setProp(servicesObj, key, serviceFn);
      }
    }
    
    context.setProp(context.global, "pipeline", pipelineModule);
    
    // Execute transformed code (async runtime supports async/await)
    const result = await context.evalCodeAsync(transformedCode, "<flow-run>");
    
    if (result.error) {
      const errorHandle = result.error;
      let errorMsg = "Execution error";
      try {
        errorMsg = context.getString(errorHandle);
      } catch {
        try {
          const json = context.dump(errorHandle);
          errorMsg = json.consume((v: unknown) => String(v));
        } catch {}
      }
      errorHandle.dispose();
      
      // Cleanup
      describeFn.dispose();
      inImgFn.dispose();
      inTextFn.dispose();
      pipelineModule.dispose();
      // Cleanup service functions
      if (servicesObj) {
        const keys = context.dump(servicesObj);
        keys.consume((obj: any) => {
          if (typeof obj === "object" && obj !== null) {
            Object.keys(obj).forEach(key => {
              try {
                const prop = context.getProp(servicesObj, key);
                if (prop) prop.dispose();
              } catch {}
            });
          }
        });
        servicesObj.dispose();
      }
      
      return {
        requestId: "", // Will be set by caller
        type: "run",
        success: false,
        error: errorMsg
      };
    }
    
    // Get the exported run function
    let runFunction: QuickJSHandle | undefined;
    try {
      // Try to get run from exports or global
      const exports = context.getProp(context.global, "exports");
      if (exports) {
        runFunction = context.getProp(exports, "run");
        exports.dispose();
      }
    } catch {
      // Try global run
      try {
        runFunction = context.getProp(context.global, "run");
      } catch {}
    }
    
    if (!runFunction) {
      // Cleanup
      if (result.value) result.value.dispose();
      describeFn.dispose();
      inImgFn.dispose();
      inTextFn.dispose();
      pipelineModule.dispose();
      // Cleanup service functions
      if (servicesObj) {
        try {
          const keys = context.dump(servicesObj);
          keys.consume((obj: any) => {
            if (typeof obj === "object" && obj !== null) {
              Object.keys(obj).forEach(key => {
                try {
                  const prop = context.getProp(servicesObj, key);
                  if (prop) prop.dispose();
                } catch {}
              });
            }
          });
        } catch {}
        servicesObj.dispose();
      }
      
      return {
        requestId: "",
        type: "run",
        success: false,
        error: "No exported run() function found"
      };
    }
    
    // Call run(services) - use evalCodeAsync to call and await the async function
    // Store services and run function in global scope temporarily
    const servicesVarName = `__services_${Date.now()}`;
    const runVarName = `__run_${Date.now()}`;
    context.setProp(context.global, servicesVarName, servicesObj);
    context.setProp(context.global, runVarName, runFunction);
    
    // Call run(services) - it's an async function that returns a Promise
    // Following README pattern (line 320): use evalCode to get a Promise handle
    // But we're using async runtime, so we need evalCodeAsync
    // However, evalCodeAsync might await the Promise, so we need to call run() directly
    // and get the Promise handle, then resolve it
    const runCall = await context.evalCodeAsync(`run(${servicesVarName})`, "<run-call>");
    
    // If there's an error, handle it
    if (runCall.error) {
      const errorHandle = runCall.error;
      let errorMsg = "run() call error";
      try {
        errorMsg = context.getString(errorHandle);
      } catch {
        try {
          const json = context.dump(errorHandle);
          errorMsg = json.consume((v: unknown) => String(v));
        } catch {}
      }
      errorHandle.dispose();
      // TypeScript narrows runCall to only have error, but value might still exist
      const runCallValue = (runCall as any).value;
      if (runCallValue) {
        runCallValue.dispose();
      }
      
      // Cleanup
      runFunction.dispose();
      if (result.value) result.value.dispose();
      describeFn.dispose();
      inImgFn.dispose();
      inTextFn.dispose();
      pipelineModule.dispose();
      try {
        context.setProp(context.global, servicesVarName, context.undefined);
        context.setProp(context.global, runVarName, context.undefined);
      } catch {}
      if (servicesObj) {
        try {
          const keys = context.dump(servicesObj);
          keys.consume((obj: any) => {
            if (typeof obj === "object" && obj !== null) {
              Object.keys(obj).forEach(key => {
                try {
                  const prop = context.getProp(servicesObj, key);
                  if (prop) prop.dispose();
                } catch {}
              });
            }
          });
        } catch {}
        servicesObj.dispose();
      }
      
      return {
        requestId: "",
        type: "run",
        success: false,
        error: errorMsg
      };
    }
    
    // If no value, that's also an error
    if (!runCall.value) {
      console.log("[DEBUG] run() call returned no value!");
      return {
        requestId: "",
        type: "run",
        success: false,
        error: "run() returned no value"
      };
    }
    
    // runCall.value should be a Promise handle (run() returns a Promise)
    // Following README pattern (lines 319-334): convert Promise handle to native Promise
    const { runtime } = await initQuickJS();
    const promiseHandle = runCall.value;
    
    // Convert the QuickJS Promise handle into a native Promise and await it
    // According to the docs: "If code like this deadlocks, make sure you are calling
    // runtime.executePendingJobs appropriately."
    // We need to execute pending jobs while the Promise resolves
    const resolvePromiseNative = context.resolvePromise(promiseHandle);
    
    // Execute pending jobs in a loop to drive Promise resolution
    // The Promise won't resolve without executing pending jobs
    const executeJobsLoop = async () => {
      let maxIterations = 1000;
      while (maxIterations-- > 0) {
        if (!runtime.hasPendingJob()) {
          // No pending jobs - give it a small delay to allow promise to settle
          await new Promise(resolve => setTimeout(resolve, 0));
          if (!runtime.hasPendingJob()) {
            break;
          }
        }
        runtime.executePendingJobs();
      }
    };
    
    // Execute jobs and await the promise - both need to complete
    await Promise.all([resolvePromiseNative, executeJobsLoop()]);
    
    // Now get the resolved result
    const resolvedResult = await resolvePromiseNative;
    promiseHandle.dispose();
    
    // Check for errors in the resolved result
    if (resolvedResult.error) {
      const errorHandle = resolvedResult.error;
      let errorMsg = "Promise rejection";
      try {
        errorMsg = context.getString(errorHandle);
      } catch {
        try {
          const json = context.dump(errorHandle);
          errorMsg = json.consume((v: unknown) => String(v));
        } catch {}
      }
      errorHandle.dispose();
      
      // Cleanup
      runFunction.dispose();
      if (result.value) result.value.dispose();
      describeFn.dispose();
      inImgFn.dispose();
      inTextFn.dispose();
      pipelineModule.dispose();
      try {
        context.setProp(context.global, servicesVarName, context.undefined);
        context.setProp(context.global, runVarName, context.undefined);
      } catch {}
      if (servicesObj) {
        try {
          const keys = context.dump(servicesObj);
          keys.consume((obj: any) => {
            if (typeof obj === "object" && obj !== null) {
              Object.keys(obj).forEach(key => {
                try {
                  const prop = context.getProp(servicesObj, key);
                  if (prop) prop.dispose();
                } catch {}
              });
            }
          });
        } catch {}
        servicesObj.dispose();
      }
      
      return {
        requestId: "",
        type: "run",
        success: false,
        error: errorMsg
      };
    }
    
    // Extract the resolved value from the handle
    // Following README pattern: resolvedResult is a VmCallResult, check for error/value
    // Use unwrapResult pattern from README line 331
    const resolvedResultAny = resolvedResult as any;
    if (resolvedResultAny.error) {
      // Handle error case
      const errorHandle = resolvedResultAny.error as QuickJSHandle;
      let errorMsg = "Promise rejection";
      try {
        errorMsg = context.getString(errorHandle);
      } catch {
        try {
          const json = context.dump(errorHandle);
          errorMsg = json.consume((v: unknown) => String(v));
        } catch {
          errorMsg = "Unknown error";
        }
      }
      errorHandle.dispose();
      
      // Cleanup
      runFunction.dispose();
      if (result.value) result.value.dispose();
      describeFn.dispose();
      inImgFn.dispose();
      inTextFn.dispose();
      pipelineModule.dispose();
      try {
        context.setProp(context.global, servicesVarName, context.undefined);
        context.setProp(context.global, runVarName, context.undefined);
      } catch {}
      if (servicesObj) {
        try {
          const keys = context.dump(servicesObj);
          keys.consume((obj: any) => {
            if (typeof obj === "object" && obj !== null) {
              Object.keys(obj).forEach(key => {
                try {
                  const prop = context.getProp(servicesObj, key);
                  if (prop) prop.dispose();
                } catch {}
              });
            }
          });
        } catch {}
        servicesObj.dispose();
      }
      
      return {
        requestId: "",
        type: "run",
        success: false,
        error: errorMsg
      };
    }
    
    if (!resolvedResult.value) {
      // No value - this is an error case
      const errorMsg = "Promise resolved to undefined";
      
      // Cleanup
      runFunction.dispose();
      if (result.value) result.value.dispose();
      describeFn.dispose();
      inImgFn.dispose();
      inTextFn.dispose();
      pipelineModule.dispose();
      try {
        context.setProp(context.global, servicesVarName, context.undefined);
        context.setProp(context.global, runVarName, context.undefined);
      } catch {}
      if (servicesObj) {
        try {
          const keys = context.dump(servicesObj);
          keys.consume((obj: any) => {
            if (typeof obj === "object" && obj !== null) {
              Object.keys(obj).forEach(key => {
                try {
                  const prop = context.getProp(servicesObj, key);
                  if (prop) prop.dispose();
                } catch {}
              });
            }
          });
        } catch {}
        servicesObj.dispose();
      }
      
      return {
        requestId: "",
        type: "run",
        success: false,
        error: errorMsg
      };
    }
    
    // Following README pattern line 331: resolvedResult.value is the handle to the resolved value
    // Extract it using the same pattern as executeFlowCode (lines 145-172)
    const resolvedHandle = resolvedResult.value;
    
    // Cleanup temporary variables
    try {
      context.setProp(context.global, servicesVarName, context.undefined);
      context.setProp(context.global, runVarName, context.undefined);
    } catch {}
    
    let resultValue: any = undefined;
    
    if (resolvedHandle) {
      try {
        // Use the same pattern as in executeFlowCode (lines 145-172)
        // Try string first (most common), then number, then dump for objects
        try {
          const str = context.getString(resolvedHandle);
          // Check if it's actually "[object Object]" which means it's an object, not a string
          if (str === "[object Object]") {
            throw new Error("Not a real string, it's an object");
          }
          resultValue = str;
        } catch (strError) {
          try {
            const num = context.getNumber(resolvedHandle);
            // Check if it's actually a valid number (not NaN)
            if (!isNaN(num)) {
              resultValue = num;
            } else {
              // NaN means it's not a number, try dump
              const json = context.dump(resolvedHandle);
              resultValue = json.consume((val: unknown) => val);
            }
          } catch (numError) {
            // For objects/other types, use JSON dump
            try {
              const json = context.dump(resolvedHandle);
              if (json && typeof json.consume === "function") {
                resultValue = json.consume((val: unknown) => val);
              } else {
                // dump didn't return a JSON object with consume
                // Try to manually extract by converting to JSON string and parsing
                // Store handle in a variable first, then stringify it
                const tempVarName = `__result_${Date.now()}`;
                context.setProp(context.global, tempVarName, resolvedHandle);
                const jsonStrHandle = await context.evalCodeAsync(`JSON.stringify(${tempVarName})`, "<json-stringify>");
                context.setProp(context.global, tempVarName, context.undefined);
                
                if (jsonStrHandle.error) {
                  jsonStrHandle.error.dispose();
                  resultValue = undefined;
                } else if (jsonStrHandle.value) {
                  try {
                    const jsonStr = context.getString(jsonStrHandle.value);
                    resultValue = JSON.parse(jsonStr);
                    jsonStrHandle.value.dispose();
                  } catch {
                    jsonStrHandle.value.dispose();
                    resultValue = undefined;
                  }
                } else {
                  resultValue = undefined;
                }
              }
            } catch (dumpError) {
              // dump failed, try JSON.stringify approach
              try {
                const tempVarName = `__result_${Date.now()}`;
                context.setProp(context.global, tempVarName, resolvedHandle);
                const jsonStrHandle = await context.evalCodeAsync(`JSON.stringify(${tempVarName})`, "<json-stringify>");
                context.setProp(context.global, tempVarName, context.undefined);
                
                if (jsonStrHandle.error) {
                  jsonStrHandle.error.dispose();
                  resultValue = undefined;
                } else if (jsonStrHandle.value) {
                  const jsonStr = context.getString(jsonStrHandle.value);
                  resultValue = JSON.parse(jsonStr);
                  jsonStrHandle.value.dispose();
                } else {
                  resultValue = undefined;
                }
              } catch {
                resultValue = undefined;
              }
            }
          }
        }
        resolvedHandle.dispose();
      } catch (error) {
        resultValue = undefined;
        if (resolvedHandle) resolvedHandle.dispose();
      }
    }
    
    
    // Cleanup
    runFunction.dispose();
    if (result.value) result.value.dispose();
    describeFn.dispose();
    inImgFn.dispose();
    inTextFn.dispose();
    pipelineModule.dispose();
    // Service functions are cleaned up with servicesObj
    servicesObj.dispose();
    
    // Return the result - always include result field even if undefined
    const response: FlowWorkerResponse = {
      requestId: "",
      type: "run",
      success: true,
      result: resultValue === undefined ? null : resultValue // Use null instead of undefined for JSON
    };
    
    
    return response;
  } catch (error) {
    return {
      requestId: "",
      type: "run",
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
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
      response.requestId = request.requestId;
    } else if (request.type === "inspect") {
      response = await handleInspectRequest(request);
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

