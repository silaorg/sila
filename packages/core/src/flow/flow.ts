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

export interface FlowSpec {
  title: string;
  description: string;
  inputs: FlowExpectedInput[];
  outputs: FlowExpectedOutput[];
}

export function getFlowInit(): { api: any, spec: FlowSpec } {
  let _title = "";
  let _description = "";
  let _inputs: FlowExpectedInput[] = [];
  let _outputs: FlowExpectedOutput[] = [];

  const api = {
    title: function (title: string) {
      _title = title;
    },

    describe: function (description: string) {
      _description = description;
    },

    inImg: function (id: string, label: string, options?: { optional?: boolean }) {
      _inputs.push({ id, label, type: "image", optional: options?.optional ?? false });
    },

    inText: function (id: string, label: string, options?: { optional?: boolean }) {
      _inputs.push({ id, label, type: "text", optional: options?.optional ?? false });
    },

    outImgs: function (id: string, label: string) {
      _outputs.push({ id, label, type: "image" });
    },

    outImg: function (id: string) {
      _outputs.push({ id, label: id, type: "image" });
    },

    outText: function (id: string) {
      _outputs.push({ id, label: id, type: "text" });
    }
  };

  return {
    api,
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

export function getFlowServices(inputs: Record<string, string> = {}, check: boolean = false) {
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

  private hasInit: boolean = false;
  private isRunning: boolean = false;
  private spec: FlowSpec | null = null;
  private runtime: QuickJSRuntime | null = null;
  private context: QuickJSContext | null = null;

  // @TODO: consider passing a service builder here so we can inject workspace-specific logic
  constructor(readonly code: string) { }

  public async init(): Promise<FlowSpec> {
    if (this.hasInit) {
      throw new Error("Flow already setup");
    }

    const quickJS = await getQuickJS();
    this.runtime = quickJS.newRuntime();
    this.context = this.runtime.newContext();

    const flowInit = getFlowInit();
    const setupHandle = bridgeObject(flowInit.api, this.context, this.runtime);

    setConsole(this.context);

    this.context.evalCode(this.code, "<flow-setup>");
    this.context.setProp(this.context.global, "setup", setupHandle);

    const initRusult = this.context.evalCode("init(setup)", "<flow-init>");

    if (initRusult.error) {
      const errorMessage = initRusult.error.consume((err) => this.context?.getString(err));
      throw new Error(`Error initializing flow: ${errorMessage}`);
    }

    this.hasInit = true;
    this.spec = flowInit.spec;
    return this.spec;
  }

  public async run(inputs: Record<string, string> = {}): Promise<Map<string, FlowOutput>> {
    if (this.isRunning) {
      console.error("Flow is already running");
      return new Map();
    }

    this.checkInputs(inputs);

    this.isRunning = true;

    if (!this.hasInit) {
      throw new Error("Flow not setup");
    }

    if (!this.runtime || !this.context) {
      throw new Error("QuickJS runtime or context not set");
    }

    const { servicesApi, result } = getFlowServices(inputs);
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

  checkInputs(inputs: Record<string, string>): void {
    if (!this.spec) {
      throw new Error("Flow spec not initialized");
    }

    const requiredInputs = this.spec.inputs.filter(input => !input.optional);
    const missingInputs = requiredInputs.filter(input => !inputs[input.id]);

    if (missingInputs.length > 0) {
      const missingIds = missingInputs.map(input => input.id).join(", ");
      const expectedIds = requiredInputs.map(input => input.id).join(", ");
      throw new Error(`Didn't get ${missingIds} out of expected ${expectedIds}`);
    }
  }
}
