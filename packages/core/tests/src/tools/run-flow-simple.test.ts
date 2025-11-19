import { describe, it, expect } from "vitest";
import { getQuickJS, newAsyncContext, type QuickJSAsyncContext } from "quickjs-emscripten";

describe("Simple async run() test", () => {
  it("executes async run() function and gets the result", async () => {
    // Create async context
    const context = await newAsyncContext();
    
    // Simple code with async run() that returns a string
    const code = `
      async function run() {
        return "done";
      }
    `;
    
    // Execute the code
    const result = await context.evalCodeAsync(code, "<test>");
    
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
      context.dispose();
      throw new Error(errorMsg);
    }
    
    result.value?.dispose();
    
    // Now call run() - it returns a Promise
    const runCall = await context.evalCodeAsync(`run()`, "<run-call>");
    
    if (runCall.error || !runCall.value) {
      const errorHandle = runCall.error;
      let errorMsg = "run() call error";
      if (errorHandle) {
        try {
          errorMsg = context.getString(errorHandle);
        } catch {
          try {
            const json = context.dump(errorHandle);
            errorMsg = json.consume((v: unknown) => String(v));
          } catch {}
        }
        errorHandle.dispose();
      }
      runCall.value?.dispose();
      context.dispose();
      throw new Error(errorMsg);
    }
    
    // runCall.value is a Promise handle - resolve it
    const { runtime } = context;
    const promiseHandle = runCall.value;
    
    // Convert to native Promise and await it
    const resolvePromiseNative = context.resolvePromise(promiseHandle);
    
    // Execute pending jobs while Promise resolves
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
    
    // Execute jobs and await the promise
    await Promise.all([resolvePromiseNative, executeJobsLoop()]);
    
    // Get the resolved result
    const resolvedResult = await resolvePromiseNative;
    promiseHandle.dispose();
    
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
      context.dispose();
      throw new Error(errorMsg);
    }
    
    if (!resolvedResult.value) {
      context.dispose();
      throw new Error("Promise resolved to undefined");
    }
    
    // Extract the value
    const resolvedHandle = resolvedResult.value;
    let resultValue: any = undefined;
    
    try {
      // Try to get as string first (most common for our use case)
      try {
        const str = context.getString(resolvedHandle);
        resultValue = str;
      } catch {
        // Try number
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
        } catch {
          // For objects/other types, use JSON dump
          const json = context.dump(resolvedHandle);
          resultValue = json.consume((val: unknown) => val);
        }
      }
      resolvedHandle.dispose();
    } catch (error) {
      resolvedHandle.dispose();
      context.dispose();
      throw error;
    }
    
    context.dispose();
    
    // Verify the result
    expect(resultValue).toBe("done");
  });

  it("executes async run() with a service that returns an object", async () => {
    // Create async context
    const context = await newAsyncContext();
    
    // Create a mock service that returns an object
    const mockService = context.newAsyncifiedFunction("processImage", async (imageHandle: any, promptHandle: any) => {
      // Convert handles to JS values (though we won't use them)
      const image = imageHandle ? context.getString(imageHandle) : null;
      const prompt = promptHandle ? context.getString(promptHandle) : null;
      
      // Return a mock result object
      const result = { processed: true, prompt: prompt || "Apply filter", imageId: image || "img-a" };
      
      // Convert back to QuickJS handle
      const resultObj = context.newObject();
      context.setProp(resultObj, "processed", context.newNumber(1)); // true as 1
      context.setProp(resultObj, "prompt", context.newString(result.prompt));
      context.setProp(resultObj, "imageId", context.newString(result.imageId));
      
      return resultObj;
    });
    
    // Create services object
    const servicesObj = context.newObject();
    context.setProp(servicesObj, "processImage", mockService);
    mockService.dispose();
    
    // Code with async run() that calls the service
    const code = `
      async function run(services) {
        const result = await services.processImage("img-a", "Apply filter");
        return result;
      }
    `;
    
    // Execute the code
    const result = await context.evalCodeAsync(code, "<test>");
    
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
      servicesObj.dispose();
      context.dispose();
      throw new Error(errorMsg);
    }
    
    result.value?.dispose();
    
    // Store services in global
    const servicesVarName = "__services_test";
    context.setProp(context.global, servicesVarName, servicesObj);
    
    // Call run(services)
    const runCall = await context.evalCodeAsync(`run(${servicesVarName})`, "<run-call>");
    
    if (runCall.error || !runCall.value) {
      const errorHandle = runCall.error;
      let errorMsg = "run() call error";
      if (errorHandle) {
        try {
          errorMsg = context.getString(errorHandle);
        } catch {
          try {
            const json = context.dump(errorHandle);
            errorMsg = json.consume((v: unknown) => String(v));
          } catch {}
        }
        errorHandle.dispose();
      }
      runCall.value?.dispose();
      context.setProp(context.global, servicesVarName, context.undefined);
      servicesObj.dispose();
      context.dispose();
      throw new Error(errorMsg);
    }
    
    // runCall.value is a Promise handle - resolve it
    const { runtime } = context;
    const promiseHandle = runCall.value;
    
    // Convert to native Promise and await it
    const resolvePromiseNative = context.resolvePromise(promiseHandle);
    
    // Execute pending jobs while Promise resolves
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
    
    // Execute jobs and await the promise
    await Promise.all([resolvePromiseNative, executeJobsLoop()]);
    
    // Get the resolved result
    const resolvedResult = await resolvePromiseNative;
    promiseHandle.dispose();
    
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
      context.setProp(context.global, servicesVarName, context.undefined);
      servicesObj.dispose();
      context.dispose();
      throw new Error(errorMsg);
    }
    
    if (!resolvedResult.value) {
      context.setProp(context.global, servicesVarName, context.undefined);
      servicesObj.dispose();
      context.dispose();
      throw new Error("Promise resolved to undefined");
    }
    
    // Extract the value (should be an object)
    const resolvedHandle = resolvedResult.value;
    let resultValue: any = undefined;
    
    try {
      // For objects, use JSON dump
      // Check what dump returns - it might be a handle that needs to be consumed
      const dumpResult = context.dump(resolvedHandle);
      if (dumpResult && typeof dumpResult.consume === "function") {
        resultValue = dumpResult.consume((val: unknown) => val);
      } else {
        // dump might have returned the value directly, or it's a different type
        // Try to manually extract object properties
        const resultObj: any = {};
        const keys = context.getProp(resolvedHandle, "processed");
        if (keys) {
          resultObj.processed = context.getNumber(keys);
          keys.dispose();
        }
        const prompt = context.getProp(resolvedHandle, "prompt");
        if (prompt) {
          resultObj.prompt = context.getString(prompt);
          prompt.dispose();
        }
        const imageId = context.getProp(resolvedHandle, "imageId");
        if (imageId) {
          resultObj.imageId = context.getString(imageId);
          imageId.dispose();
        }
        resultValue = resultObj;
      }
      resolvedHandle.dispose();
    } catch (error) {
      resolvedHandle.dispose();
      context.setProp(context.global, servicesVarName, context.undefined);
      servicesObj.dispose();
      context.dispose();
      throw error;
    }
    
    context.setProp(context.global, servicesVarName, context.undefined);
    servicesObj.dispose();
    context.dispose();
    
    // Verify the result
    expect(resultValue).toBeDefined();
    expect(resultValue.processed).toBe(1); // We set it as 1 (true)
    expect(resultValue.imageId).toBe("img-a");
    expect(resultValue.prompt).toBe("Apply filter");
  });
});

