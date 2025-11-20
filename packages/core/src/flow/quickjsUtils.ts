import { QuickJSContext, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten";

/**
 * Bridges an object to the QuickJS context - exposes functions that QuickJS context can call.
 * @param context - The QuickJS context to bridge the object to.
 * @param runtime - The QuickJS runtime to use.
 * @param target - The object to bridge.
 * @returns The bridged object.
 */
export function bridgeObject(target: object, context: QuickJSContext, runtime: QuickJSRuntime): QuickJSHandle {
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

/**
 * Converts a QuickJS handle to a JS value.
 * @param context - The QuickJS context to use.
 * @param arg - The QuickJS handle to convert.
 * @returns The JS value.
 */
export function handleToValue(context: QuickJSContext, arg: QuickJSHandle): any {
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

/**
 * Converts a JS value to a QuickJS handle.
 * @param context - The QuickJS context to use.
 * @param value - The JS value to convert.
 * @returns The QuickJS handle.
 */
export function valueToHandle(context: QuickJSContext, value: any): QuickJSHandle {
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