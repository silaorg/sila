
import { FileReference } from "@sila/core";
import { getQuickJS, newAsyncContext, QuickJSAsyncContext, QuickJSContext, QuickJSHandle, QuickJSRuntime, VmCallResult } from "quickjs-emscripten";

// Helper to convert QuickJS handle to JS value
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

// Helper to convert JS value to QuickJS handle
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

export interface FlowExpectedInput {
  id: string;
  label: string;
  type: "image" | "text";
  optional: boolean;
}

export interface FlowExpectedOutput {
  id: string;
  label: string;
  type: "image" | "text";
}

export function getSetup() {
  return {
    _title: "",
    _description: "",
    _inputs: [] as FlowExpectedInput[],
    _outputs: [] as FlowExpectedOutput[],

    title: function (title: string) {
      this._title = title;
    },

    describe: function (description: string) {
      this._description = description;
    },

    inImg: function (id: string, label: string) {
      this._inputs.push({ id, label, type: "image", optional: false });
    },

    outImgs: function (id: string, label: string) {
      this._outputs.push({ id, label, type: "image" });
    }
  }
}

export interface FlowOutput {
  id: string;
  file: FileReference;
}

export function getServices() {
  return {
    _outputMap: new Map(),

    img: async function (prompt: string) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { kind: "file", fileId: "123", meta: { prompt } };
    },

    outputs: function (id: string, value: any) {
      console.log(`Output ${id}:`, value);
      this._outputMap.set(id, value);
    }
  }
}
