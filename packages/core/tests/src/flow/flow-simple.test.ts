import { Flow } from "@sila/core";
import { describe, it, expect } from "vitest";

describe("Flow simple test", () => {

  it("runs a flow with inputs and outputs", async () => {
    const code = `
function init(setup) {
	setup.title("Echo");
	setup.inText("user", "Say something");
	setup.outText("echo");
}

async function run(services) {
	const prompt = services.input("user");
  console.log("Echoing", prompt);	
	services.output("echo", "Echo: " + prompt);
}
`;

    const flow = new Flow(code);
    const spec = await flow.init();
    expect(spec.title).toBe("Echo");
    expect(spec.inputs[0].label).toBe("Say something");

    const result = await flow.run({ user: "Say something" });
    expect(result.get("echo")).toBe("Echo: Say something");
  });


  it("runs a flow with a use of services.img", async () => {
    const code = `
function init(setup) {
  setup.title("Create any image")
  setup.inText("prompt", "An image to create")
  setup.outImg("img")
}

async function run(services) {
  console.log("Starting flow");

  console.log("Getting input");
  const prompt = services.inputs["prompt"];
  console.log("Calling img", prompt);
  const result = await services.img(prompt);
  console.log("Outputting result", result);
	
  services.output("img", result);
}
`;

    // @TODO: Implement this test

  });

  it("throws error with missing inputs", async () => {
    const code = `
function init(setup) {
  setup.title("Test Flow");
  setup.inText("input1", "First input");
  setup.inText("input2", "Second input");
  setup.inText("input3", "Third optional input", { optional: true });
  setup.outText("output");
}

async function run(services) {
  services.output("output", "done");
}
`;

    const flow = new Flow(code);
    await flow.init();

    // Missing both inputs
    await expect(flow.run({})).rejects.toThrow();

    // Missing one input
    await expect(flow.run({ input1: "value1" })).rejects.toThrow();

    // Having all required inputs
    const result = await flow.run({ input1: "value1", input2: "value2" });
    expect(result.get("output")).toBe("done");
  });


});