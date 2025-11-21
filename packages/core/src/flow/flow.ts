import { getQuickJS, QuickJSContext, QuickJSHandle, QuickJSRuntime } from "quickjs-emscripten";

import { bridgeObject, FileReference } from "@sila/core";

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
  let _title = "";
  let _description = "";
  let _inputs: FlowExpectedInput[] = [];
  let _outputs: FlowExpectedOutput[] = [];

  const setupApi = {
    title: function (title: string) {
      _title = title;
    },

    describe: function (description: string) {
      _description = description;
    },

    inImg: function (id: string, label: string) {
      _inputs.push({ id, label, type: "image", optional: false });
    },

    outImgs: function (id: string, label: string) {
      _outputs.push({ id, label, type: "image" });
    }
  };

  return {
    setupApi,
    get spec() {
      return {
        title: _title,
        description: _description,
        inputs: _inputs,
        outputs: _outputs
      };
    }
  };
}

export interface FlowOutputFile {
  id: string;
  file: FileReference;
}

export type FlowOutput = string | boolean | number | FileReference;

export function getServices(inputs: Record<string, string> = {}, check: boolean = false) {
  let _outputMap = new Map<string, FlowOutput>();

  const servicesApi = {
    img: async function (prompt: string) {
      if (check) {
        // @TODO: Return a dummy file reference
        throw new Error("Not implemented");
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      return { kind: "file", fileId: "123", meta: { prompt } };
    },

    output: function (id: string, value: any) {
      console.log(`Output ${id}:`, value);
      _outputMap.set(id, value);
    },

    input: function (id: string) {
      return inputs[id];
    }
  };

  return {
    servicesApi,
    get result() {
      return {
        outputs: _outputMap
      };
    }
  };
}

function setConsole(context: QuickJSContext) {
  const _console = context.newObject();
  context.setProp(_console, "log", context.newFunction("log", (...args: QuickJSHandle[]) => {
    const parts: string[] = [];
    for (const arg of args) {
      parts.push(context.getString(arg));
    }
    console.log(parts.join(" "));

    return context.undefined;
  }));

  context.setProp(_console, "error", context.newFunction("error", (...args: QuickJSHandle[]) => {
    const parts: string[] = [];
    for (const arg of args) {
      parts.push(context.getString(arg));
    }
    console.error(parts.join(" "));
  }));

  context.setProp(context.global, "console", _console);

  return _console;
}

export class Flow {

  private hasSetup: boolean = false;
  private isRunning: boolean = false;
  private runtime: QuickJSRuntime | null = null;
  private context: QuickJSContext | null = null;

  constructor(readonly code: string) { }

  public async setup() {
    if (this.hasSetup) {
      throw new Error("Flow already setup");
    }

    const quickJS = await getQuickJS();
    this.runtime = quickJS.newRuntime();
    this.context = this.runtime.newContext();

    const { setupApi } = getSetup();
    const setupHandle = bridgeObject(setupApi, this.context, this.runtime);

    setConsole(this.context);

    this.context.evalCode(this.code, "<flow-setup>");
    this.context.setProp(this.context.global, "setup", setupHandle);

    this.hasSetup = true;
  }

  public async run(inputs: Record<string, string> = {}): Promise<Map<string, FlowOutput>> {
    if (this.isRunning) {
      console.error("Flow is already running");
      return new Map();
    }

    this.isRunning = true;

    if (!this.hasSetup) {
      throw new Error("Flow not setup");
    }

    if (!this.runtime || !this.context) {
      throw new Error("QuickJS runtime or context not set");
    }

    const { servicesApi, result } = getServices(inputs);
    const servicesHandle = bridgeObject(servicesApi, this.context, this.runtime);
    this.context.setProp(this.context.global, "services", servicesHandle);

    const runResult = this.context.evalCode("run(services)", "<flow-run>");

    if (runResult.error) {
      throw new Error(runResult.error.consume((err) => this.context?.getString(err)));
    }

    this.isRunning = false;

    return result.outputs;
  }

  public async check(): Promise<{ pass: boolean, error?: string }> {
    /* TODO: 
    - [ ] Gather dummy inputs based on what is expected in the flow
    - [ ] Get services with check set to true
    - [ ] Run the flow with the dummy inputs
    - [ ] Return the result of the check
    */

    return { pass: true };
  }
}
