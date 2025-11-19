import { getQuickJS, newAsyncContext, type QuickJSAsyncContext, type QuickJSAsyncRuntime, type QuickJSHandle } from "quickjs-emscripten";

// Message protocol between main thread and worker
export interface FlowWorkerRequest {
  requestId: string;
  type: "run" | "lint" | "inspect";
  code?: string; // For run/inspect requests
  path?: string; // For lint requests (future)
  args?: string[]; // For run requests
  services?: any; // Services descriptor for run requests (serializable, not functions)
  inputs?: Record<string, any>; // Input values for run requests (serializable)
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
  outputs?: Record<string, any>;
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
 * Inspect flow code by calling setup(flow) to extract metadata.
 * 
 * Expected API pattern:
 * ```js
 * function setup(flow) {
 *   flow.title("Title");
 *   flow.describe("Description");
 *   flow.inImg("img-a", "Label");
 *   flow.inText("text-b", "Label");
 * }
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
    
    // Track metadata during setup() execution
    let title: string | undefined;
    let description: string | undefined;
    const inputs: Array<{ id: string; type: string; label: string; optional?: boolean }> = [];
    const outputs: Array<{ id: string; type: string; label: string }> = [];
    
    // Create flow API object that tracks metadata
    const flowObj = context.newObject();
    
    // title() function
    const titleFn = context.newFunction("title", (titleHandle: QuickJSHandle) => {
      try {
        title = context.getString(titleHandle);
      } catch {
        // Ignore if not a string
      }
      return context.undefined;
    });
    context.setProp(flowObj, "title", titleFn);
    
    // describe() function
    const describeFn = context.newFunction("describe", (descHandle: QuickJSHandle) => {
      try {
        description = context.getString(descHandle);
      } catch {
        // Ignore if not a string
      }
      return context.undefined;
    });
    context.setProp(flowObj, "describe", describeFn);
    
    // inImg() function
    const inImgFn = context.newFunction("inImg", (idHandle: QuickJSHandle, labelHandle: QuickJSHandle, optionsHandle?: QuickJSHandle) => {
      try {
        const id = context.getString(idHandle);
        const label = context.getString(labelHandle);
        const optional = optionsHandle ? (() => {
          try {
            const options = context.dump(optionsHandle);
            const opts = options.consume((v: any) => v);
            return opts?.optional === true;
          } catch {
            return false;
          }
        })() : false;
        inputs.push({ id, type: "image", label, optional });
        return context.undefined;
      } catch {
        return context.undefined;
      }
    });
    context.setProp(flowObj, "inImg", inImgFn);
    
    // inText() function
    const inTextFn = context.newFunction("inText", (idHandle: QuickJSHandle, labelHandle: QuickJSHandle, optionsHandle?: QuickJSHandle) => {
      try {
        const id = context.getString(idHandle);
        const label = context.getString(labelHandle);
        const optional = optionsHandle ? (() => {
          try {
            const options = context.dump(optionsHandle);
            const opts = options.consume((v: any) => v);
            return opts?.optional === true;
          } catch {
            return false;
          }
        })() : false;
        inputs.push({ id, type: "text", label, optional });
        return context.undefined;
      } catch {
        return context.undefined;
      }
    });
    context.setProp(flowObj, "inText", inTextFn);
    
    // outImgs() function
    const outImgsFn = context.newFunction("outImgs", (idHandle: QuickJSHandle, labelHandle: QuickJSHandle) => {
      try {
        const id = context.getString(idHandle);
        const label = context.getString(labelHandle);
        outputs.push({ id, type: "image", label });
        return context.undefined;
      } catch {
        return context.undefined;
      }
    });
    context.setProp(flowObj, "outImgs", outImgsFn);
    
    // Execute code to define setup() and run() functions
    const result = await context.evalCodeAsync(request.code, "<flow-inspect>");
    
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
      
      // Cleanup
      titleFn.dispose();
      describeFn.dispose();
      inImgFn.dispose();
      inTextFn.dispose();
      outImgsFn.dispose();
      flowObj.dispose();
      
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
    
    // Get the setup function and call it
    let setupFunction: QuickJSHandle | undefined;
    try {
      setupFunction = context.getProp(context.global, "setup");
    } catch {}
    
    if (!setupFunction) {
      // Cleanup
      titleFn.dispose();
      describeFn.dispose();
      inImgFn.dispose();
      inTextFn.dispose();
      outImgsFn.dispose();
      flowObj.dispose();
      
      return {
        requestId: request.requestId,
        type: "inspect",
        success: false,
        error: "No setup() function found"
      };
    }
    
    // Call setup(flow)
    const setupVarName = `__flow_${Date.now()}`;
    context.setProp(context.global, setupVarName, flowObj);
    const setupCall = await context.evalCodeAsync(`setup(${setupVarName})`, "<setup-call>");
    context.setProp(context.global, setupVarName, context.undefined);
    
    // Cleanup
    titleFn.dispose();
    describeFn.dispose();
    inImgFn.dispose();
    inTextFn.dispose();
    outImgsFn.dispose();
    flowObj.dispose();
    setupFunction.dispose();
    
    if (setupCall.error) {
      const errorHandle = setupCall.error;
      let errorMsg = "setup() call error";
      try {
        errorMsg = context.getString(errorHandle);
      } catch {
        try {
          const json = context.dump(errorHandle);
          errorMsg = json.consume((v: unknown) => String(v));
        } catch {}
      }
      errorHandle.dispose();
      const setupCallValue = (setupCall as any).value;
      if (setupCallValue) {
        setupCallValue.dispose();
      }
      
      return {
        requestId: request.requestId,
        type: "inspect",
        success: false,
        error: errorMsg
      };
    }
    
    if (setupCall.value) {
      setupCall.value.dispose();
    }
    
    return {
      requestId: request.requestId,
      type: "inspect",
      success: true,
      metadata: {
        description: title || description,
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
    const result = await executeFlowCodeWithServices(request.code, request.services, request.inputs);
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
 * function setup(flow) {
 *   flow.title("Title");
 *   flow.describe("Description");
 *   flow.inImg("img-a", "Label");
 * }
 * 
 * async function run(services) {
 *   const imgA = services.inputs["img-a"];
 *   const result = await services.img([imgA], "prompt");
 *   services.outputs("img-out", result);
 *   return result;
 * }
 * ```
 */
// Global service registry for registered service functions
const serviceRegistry = new Map<string, Function>();

function convertHandleToJS(context: QuickJSAsyncContext, handle?: QuickJSHandle, disposeHandle = true): any {
  if (!handle) {
    return undefined;
  }

  try {
    try {
      const str = context.getString(handle);
      if (str !== "[object Object]") {
        return str;
      }
    } catch {}

    try {
      const num = context.getNumber(handle);
      if (!Number.isNaN(num)) {
        return num;
      }
    } catch {}

    try {
      const dumped = context.dump(handle);
      return dumped.consume((val: unknown) => val);
    } catch {
      return undefined;
    }
  } finally {
    if (disposeHandle) {
      try {
        handle.dispose();
      } catch {}
    }
  }
}

function generateMockId(prefix: string): string {
  const rand = Math.floor(Math.random() * 1_000_000);
  return `${prefix}-${Date.now()}-${rand}`;
}

function simulateImageService(args: any[], descriptor: any) {
  const [images = [], prompt = "", options = {}] = args;
  const id = descriptor?.fileId ?? generateMockId("test-img");
  return {
    kind: "file",
    fileId: id,
    mimeType: "image/png",
    name: descriptor?.name ?? `${id}.png`,
    meta: {
      simulated: true,
      prompt,
      options,
      inputCount: Array.isArray(images) ? images.length : images ? 1 : 0,
    },
  };
}

function simulateAgentService(args: any[], descriptor: any) {
  const [input, prompt = ""] = args;
  return {
    kind: "text",
    value: `Simulated agent response for prompt: ${prompt}`,
    meta: {
      simulated: true,
      inputSummary: typeof input === "string" ? input.slice(0, 120) : input,
      persona: descriptor?.persona ?? "test-agent",
    },
  };
}

// Helper to extract object values via JSON.stringify when dump() doesn't work
async function extractObjectViaJSONStringify(context: QuickJSAsyncContext, handle: QuickJSHandle): Promise<any> {
  const tempVarName = `__result_${Date.now()}`;
  context.setProp(context.global, tempVarName, handle);
  const jsonStrHandle = await context.evalCodeAsync(`JSON.stringify(${tempVarName})`, "<json-stringify>");
  context.setProp(context.global, tempVarName, context.undefined);
  
  if (jsonStrHandle.error) {
    jsonStrHandle.error.dispose();
    return undefined;
  }
  
  if (!jsonStrHandle.value) {
    return undefined;
  }
  
  try {
    const jsonStr = context.getString(jsonStrHandle.value);
    const result = JSON.parse(jsonStr);
    jsonStrHandle.value.dispose();
    return result;
  } catch {
    jsonStrHandle.value.dispose();
    return undefined;
  }
}

async function executeFlowCodeWithServices(code: string, servicesDescriptor: any, inputsMap?: Record<string, any>): Promise<FlowWorkerResponse> {
  try {
    const { context } = await initQuickJS();
    
    // Execute code to define setup() and run() functions
    const codeResult = await context.evalCodeAsync(code, "<flow-run>");
    
    if (codeResult.error) {
      const errorHandle = codeResult.error;
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
      const codeResultValue = (codeResult as any).value;
      if (codeResultValue) {
        codeResultValue.dispose();
      }
      
      return {
        requestId: "",
        type: "run",
        success: false,
        error: errorMsg
      };
    }
    
    if (codeResult.value) {
      codeResult.value.dispose();
    }
    
    // Get the run function
    let runFunction: QuickJSHandle | undefined;
    try {
      runFunction = context.getProp(context.global, "run");
    } catch {}
    
    if (!runFunction) {
      return {
        requestId: "",
        type: "run",
        success: false,
        error: "No run() function found"
      };
    }
    
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
    
      // Helper to create mock services from descriptors
      function createMockService(name: string, descriptor: any): Function {
        return async (...args: any[]) => {
          if (descriptor?.simulate === "img") {
            return simulateImageService(args, descriptor);
          }
          if (descriptor?.simulate === "agent") {
            return simulateAgentService(args, descriptor);
          }
          if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, "returns")) {
            return descriptor.returns;
          }
          return { service: name, args, mock: true };
        };
      }
      
      // Create services object with inputs, outputs, and service functions
      const servicesObj = context.newObject();
      const outputValues: Record<string, any> = {};
    
    // Create inputs object - for now just an empty object (will be populated later)
    const inputsObj = context.newObject();
    if (inputsMap) {
      for (const [key, value] of Object.entries(inputsMap)) {
        const handle = await convertToQuickJSHandle(value);
        context.setProp(inputsObj, key, handle);
      }
    }
    context.setProp(servicesObj, "inputs", inputsObj);
    
      // Create outputs function that collects values
      const outputsFn = context.newFunction("outputs", (idHandle: QuickJSHandle, valueHandle: QuickJSHandle) => {
        let id: string | undefined;
        try {
          id = context.getString(idHandle);
        } catch {
          id = undefined;
        } finally {
          if (idHandle) {
            try {
              idHandle.dispose();
            } catch {}
          }
        }

        if (!id) {
          if (valueHandle) {
            try {
              valueHandle.dispose();
            } catch {}
          }
          return context.undefined;
        }

        const value = convertHandleToJS(context, valueHandle);
        outputValues[id] = value;
        return context.undefined;
      });
      context.setProp(servicesObj, "outputs", outputsFn);
    
    // Add service functions (e.g., services.img, services.agent, etc.)
    if (servicesDescriptor && typeof servicesDescriptor === "object") {
      for (const [key, descriptor] of Object.entries(servicesDescriptor)) {
        const serviceImpl = typeof descriptor === "function" 
          ? descriptor 
          : serviceRegistry.get(key) || createMockService(key, descriptor);
        
        // Create async function that calls the service and returns a Promise
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
          
          // Call the service function (which may be async)
          const result = await Promise.resolve(serviceImpl(...jsArgs));
          
          // Convert result back to QuickJS handle
          const handle = await convertToQuickJSHandle(result);
          return handle;
        });
        context.setProp(servicesObj, key, serviceFn);
      }
    }
    
    // Store services in global scope temporarily
    const servicesVarName = `__services_${Date.now()}`;
    context.setProp(context.global, servicesVarName, servicesObj);
    
    // Call run(services) - it's an async function that returns a Promise
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
      const runCallValue = (runCall as any).value;
      if (runCallValue) {
        runCallValue.dispose();
      }
      
      // Cleanup
      runFunction.dispose();
      inputsObj.dispose();
      outputsFn.dispose();
      try {
        context.setProp(context.global, servicesVarName, context.undefined);
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
      runFunction.dispose();
      inputsObj.dispose();
      outputsFn.dispose();
      try {
        context.setProp(context.global, servicesVarName, context.undefined);
      } catch {}
      servicesObj.dispose();
      
      return {
        requestId: "",
        type: "run",
        success: false,
        error: "run() returned no value"
      };
    }
    
    // runCall.value is a Promise handle (run() returns a Promise)
    // Convert it to a native Promise and await it
    const { runtime } = await initQuickJS();
    const promiseHandle = runCall.value;
    const resolvePromiseNative = context.resolvePromise(promiseHandle);
    
    // Execute pending jobs in a loop to drive Promise resolution
    const executeJobsLoop = async () => {
      let maxIterations = 1000;
      while (maxIterations-- > 0) {
        if (!runtime.hasPendingJob()) {
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
    const resolvedResult = await resolvePromiseNative;
    promiseHandle.dispose();
    
    // Check for errors in the resolved result
    const resolvedResultChecked = resolvedResult as any;
    if (resolvedResultChecked.error) {
      const errorHandle = resolvedResultChecked.error as QuickJSHandle;
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
      inputsObj.dispose();
      outputsFn.dispose();
      try {
        context.setProp(context.global, servicesVarName, context.undefined);
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
    
    if (!resolvedResultChecked.value) {
      runFunction.dispose();
      inputsObj.dispose();
      outputsFn.dispose();
      try {
        context.setProp(context.global, servicesVarName, context.undefined);
      } catch {}
      servicesObj.dispose();
      
      return {
        requestId: "",
        type: "run",
        success: false,
        error: "Promise resolved to undefined"
      };
    }
    
    // Extract the resolved value from the handle
    const resolvedHandle = resolvedResultChecked.value;
    
    // Cleanup temporary variables
    try {
      context.setProp(context.global, servicesVarName, context.undefined);
    } catch {}
    
    let resultValue: any = undefined;
    
    if (resolvedHandle) {
      try {
        // Try to extract as string, number, or object
        try {
          const str = context.getString(resolvedHandle);
          // getString() returns "[object Object]" for objects, so check for that
          if (str === "[object Object]") {
            throw new Error("Not a real string, it's an object");
          }
          resultValue = str;
        } catch {
          try {
            const num = context.getNumber(resolvedHandle);
            if (!isNaN(num)) {
              resultValue = num;
            } else {
              // NaN means it's not a number, try dump
              const json = context.dump(resolvedHandle);
              resultValue = json.consume((val: unknown) => val);
            }
          } catch {
            // For objects, try dump first, then fallback to JSON.stringify
            try {
              const json = context.dump(resolvedHandle);
              if (json && typeof json.consume === "function") {
                resultValue = json.consume((val: unknown) => val);
              } else {
                // dump didn't return a JSON object with consume, use JSON.stringify fallback
                resultValue = await extractObjectViaJSONStringify(context, resolvedHandle);
              }
            } catch {
              resultValue = await extractObjectViaJSONStringify(context, resolvedHandle);
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
    inputsObj.dispose();
    outputsFn.dispose();
    servicesObj.dispose();
    
    // Return the result - use null instead of undefined for JSON serialization
      const response: FlowWorkerResponse = {
        requestId: "",
        type: "run",
        success: true,
        result: resultValue === undefined ? null : resultValue,
        outputs: outputValues
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

