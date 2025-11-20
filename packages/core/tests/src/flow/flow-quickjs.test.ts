import { describe, it, expect } from "vitest";

import { getQuickJS, QuickJSContext, QuickJSHandle, VmCallResult } from "quickjs-emscripten";
import { bridgeObject } from "@sila/core";

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

    const servicesObj = bridgeObject(services, context, runtime);

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