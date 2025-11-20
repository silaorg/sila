import { describe, it, expect } from "vitest";

import { getQuickJS, newAsyncContext, QuickJSAsyncContext, QuickJSContext, QuickJSHandle, QuickJSRuntime, VmCallResult } from "quickjs-emscripten";

function turnObjectIntoQuickJSObject(context: QuickJSContext, runtime: QuickJSRuntime, target: object) {
  const obj = context.newObject();
  for (const [key, value] of Object.entries(target)) {

    if (typeof value === "function") {
      if (value.constructor.name === 'AsyncFunction') {
        // For async functions, create a promise manually (like in the working test)
        const fnHandle = context.newFunction(key, (...args: QuickJSHandle[]) => {
          // Convert QuickJS handles to JS values
          const jsArgs = args.map(arg => {
            // Try number first
            try {
              const num = context.getNumber(arg);
              if (!Number.isNaN(num)) return num;
            } catch {}
            
            // Try boolean
            if (arg === context.true) return true;
            if (arg === context.false) return false;
            
            // Try string
            try {
              const str = context.getString(arg);
              if (str !== "[object Object]") return str;
            } catch {}
            
            // For objects, use dump
            try {
              const dumped = context.dump(arg);
              return dumped.consume((v: unknown) => v);
            } catch {
              return undefined;
            }
          });
          
          // Create a promise
          const deferred = context.newPromise();
          
          // Call the async function and resolve the promise when done
          Promise.resolve(value(...jsArgs)).then(result => {
            // Convert result back to QuickJS handle
            let resultHandle: QuickJSHandle;
            if (typeof result === "string") {
              resultHandle = context.newString(result);
            } else if (typeof result === "number") {
              resultHandle = context.newNumber(result);
            } else if (typeof result === "boolean") {
              resultHandle = result ? context.true : context.false;
            } else if (result === null || result === undefined) {
              resultHandle = context.undefined;
            } else {
              // For objects, use JSON
              const jsonStr = JSON.stringify(result);
              const parsed = context.evalCode(`JSON.parse(${JSON.stringify(jsonStr)})`, "<result>");
              if (parsed.error) {
                parsed.error.dispose();
                resultHandle = context.undefined;
              } else {
                resultHandle = context.unwrapResult(parsed);
              }
            }
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
          const jsArgs = args.map(arg => {
            // Try boolean first (exact comparison)
            if (arg === context.true) return true;
            if (arg === context.false) return false;

            // Try number
            try {
              const num = context.getNumber(arg);
              if (!Number.isNaN(num)) return num;
            } catch { }

            // Try string, but skip if it's "[object Object]" (means it's actually an object)
            try {
              const str = context.getString(arg);
              if (str !== "[object Object]") return str;
            } catch { }

            // For objects, try dump carefully
            try {
              const dumped = context.dump(arg);
              const result = dumped.consume((v: unknown) => v);
              // Only return if it's actually an object/array, not a primitive
              if (result !== null && typeof result === "object") {
                return result;
              }
            } catch { }

            // Fallback: return undefined for complex types we can't convert in sync
            return undefined;
          });
          // Call the function with JS values
          const result = value(...jsArgs);
          // Convert result back to QuickJS handle
          if (typeof result === "string") {
            return context.newString(result);
          } else if (typeof result === "number") {
            return context.newNumber(result);
          } else if (typeof result === "boolean") {
            return result ? context.true : context.false;
          } else if (result === null || result === undefined) {
            return context.undefined;
          } else {
            // For objects, return undefined for now (sync functions can't easily create objects)
            // In practice, you'd want to handle this more carefully
            return context.undefined;
          }
        }));
      }
    } else {
      context.setProp(obj, key, context.newString(String(value)));
    }
  }
  return obj;
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