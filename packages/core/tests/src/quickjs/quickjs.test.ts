import { describe, it, expect } from "vitest";

import { getQuickJS, newAsyncContext, QuickJSAsyncContext, QuickJSContext, QuickJSHandle, QuickJSRuntime, VmCallResult } from "quickjs-emscripten";

// Helper to convert QuickJS handle to JS value
function handleToValue(context: QuickJSContext, arg: QuickJSHandle): any {
  // Try boolean first (exact comparison)
  if (arg === context.true) return true;
  if (arg === context.false) return false;

  // Try number
  try {
    const num = context.getNumber(arg);
    if (!Number.isNaN(num)) return num;
  } catch {}

  // Try string, but skip if it's "[object Object]" (means it's actually an object)
  try {
    const str = context.getString(arg);
    if (str !== "[object Object]") return str;
  } catch {}

  // For objects, use dump
  try {
    const dumped = context.dump(arg);
    if (dumped) {
      return dumped;
    } else {
      return undefined;
    }
  } catch {
    return undefined;
  }
}

// Helper to convert JS value to QuickJS handle
function valueToHandle(context: QuickJSContext, value: any): QuickJSHandle {
  if (typeof value === "string") {
    return context.newString(value);
  } else if (typeof value === "number") {
    return context.newNumber(value);
  } else if (typeof value === "boolean") {
    return value ? context.true : context.false;
  } else if (value === null || value === undefined) {
    return context.undefined;
  } else {
    // For objects/arrays, use JSON.parse (simplest approach per docs)
    const jsonStr = JSON.stringify(value);
    const parsed = context.evalCode(`JSON.parse(${JSON.stringify(jsonStr)})`, "<js-to-quickjs>");
    if (parsed.error) {
      parsed.error.dispose();
      return context.undefined;
    } else {
      return context.unwrapResult(parsed);
    }
  }
}

function handleError(handle: VmCallResult<QuickJSHandle>, context: QuickJSContext) {
  if (handle.error) {
    const errorHandle = handle.error;
    const errorMessage = context.getString(errorHandle);
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

describe("QuickJS Tests", () => {
  it("should work for code eval (sanity check to make sure quickjs works)", async () => {
    const quickJS = await getQuickJS();
    const vm = quickJS.newRuntime();
    const context = vm.newContext();

    const code = `
function foo() {
  return "hello, ";
}

function bar(obj) {
  obj.says = "world!";
}
`;

    context.evalCode(code, "<test>");
    const fooResult = context.evalCode("foo()", "<foo>");

    if (fooResult.error) {
      const errorHandle = fooResult.error;
      const errorMessage = context.getString(errorHandle);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const fooValue = context.getString(fooResult.value);
    expect(fooValue).toBe("hello, ");

    const obj = context.newObject();
    context.setProp(context.global, "_barObj", obj);

    context.evalCode("bar(_barObj)", "<bar>");

    const barProp = context.getProp(obj, "says");
    const barValue = context.getString(barProp);
    expect(barValue).toBe("world!");
  });

  it("should handle async functions (sanity check to make sure quickjs works)", async () => {
    const quickJs = await getQuickJS();
    const runtime = quickJs.newRuntime();
    const vm = runtime.newContext();

    const fooHandle = vm.newFunction("foo", (handle: QuickJSHandle) => {
      const deferred = vm.newPromise();
      setTimeout(() => {
        deferred.resolve(vm.newString("hello!"));
      }, 1000);
      // This is very important not to miss in other similar cases:
      // we must executePendingJobs manually
      deferred.settled.then(runtime.executePendingJobs);
      return deferred.handle
    });

    vm.setProp(vm.global, "foo", fooHandle);

    const result = vm.evalCode("foo()", "<foo>");

    if (result.error) {
      handleError(result, vm);
      return;
    }

    const promiseHandle = vm.unwrapResult(result);
    const resolvedResult = await vm.resolvePromise(promiseHandle);
    promiseHandle.dispose();
    const resolvedHandle = vm.unwrapResult(resolvedResult);
    const fooValue = vm.getString(resolvedHandle);
    resolvedHandle.dispose();
    
    expect(fooValue).toBe("hello!");
  });

  function turnObjectIntoQuickJSObject(context: QuickJSContext, runtime: QuickJSRuntime, target: object) {
    const obj = context.newObject();
    for (const [key, value] of Object.entries(target)) {
      if (typeof value === "function") {
        if (value.constructor.name === 'AsyncFunction') {
          // For async functions, create a promise manually (like in the working test)
          const fnHandle = context.newFunction(key, (...args: QuickJSHandle[]) => {
            // Convert QuickJS handles to JS values
            const jsArgs = args.map(arg => handleToValue(context, arg));
            
            // Create a promise
            const deferred = context.newPromise();
            
            // Call the async function and resolve the promise when done
            Promise.resolve(value(...jsArgs)).then(result => {
              // Convert result back to QuickJS handle
              const resultHandle = valueToHandle(context, result);
              deferred.resolve(resultHandle);
            }).catch(error => {
              const errorHandle = context.newString(String(error));
              deferred.reject(errorHandle);
            });
            
            // IMPORTANT: schedule executePendingJobs when promise settles
            deferred.settled.then(runtime.executePendingJobs);
            
            return deferred.handle;
          });
          context.setProp(obj, key, fnHandle);
        }
        else {
          context.setProp(obj, key, context.newFunction(key, (...args: QuickJSHandle[]) => {
            // Convert QuickJS handles to JS values
            // Note: We don't dispose these handles - QuickJS manages their lifetime
            const jsArgs = args.map(arg => handleToValue(context, arg));
            // Call the function with JS values
            const result = value(...jsArgs);
            // Convert result back to QuickJS handle
            return valueToHandle(context, result);
          }));
        }
      } else {
        context.setProp(obj, key, context.newString(String(value)));
      }
    }
    return obj;
  }
  

  it("should parse and execute functions from the outside", async () => {
    const quickJS = await getQuickJS();
    const runtime = quickJS.newRuntime();
    const context = runtime.newContext();

    const outputMap = new Map();
    const services = {
      img: async function (prompt: string) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { kind: "file", fileId: "123", meta: { prompt } };
      },
      outputs: function (id: string, value: any) {
        console.log(`Output ${id}:`, value);
        outputMap.set(id, value);
      }
    }

    const servicesObj = turnObjectIntoQuickJSObject(context, runtime, services);

    const code = `
async function run(services) {
  const imgResultA = await services.img("Make a picture of a cat");
  const imgResultB = await services.img("Make a picture of a dog");
  
  services.outputs("cat", imgResultA);
  services.outputs("dog", imgResultB);
}
    `;

    const codeResult = context.evalCode(code, "<run>");
    if (codeResult.error) {
      handleError(codeResult, context);
      return;
    }

    context.setProp(context.global, "services", servicesObj);

    const runResult = context.evalCode("run(services)", "<run-call>");
    if (runResult.error) {
      handleError(runResult, context);
      return;
    }

    // run(services) is async – runResult.value is a Promise handle
    const promiseHandle = context.unwrapResult(runResult);
    const resolvedResult = await context.resolvePromise(promiseHandle);
    promiseHandle.dispose();
    
    if (resolvedResult.error) {
      handleError(resolvedResult, context);
      return;
    }

    expect(outputMap.get("cat")).toBeDefined();
    expect(outputMap.get("cat").kind).toBe("file");
    expect(outputMap.get("cat").fileId).toBe("123");
    expect(outputMap.get("cat").meta.prompt).toBe("Make a picture of a cat");

    expect(outputMap.get("dog")).toBeDefined();
    expect(outputMap.get("dog").kind).toBe("file");
    expect(outputMap.get("dog").fileId).toBe("123");
    expect(outputMap.get("dog").meta.prompt).toBe("Make a picture of a dog");
  });
});