import { Flow } from "@sila/core";
import { describe, it, expect } from "vitest";

describe("Flow simple test", () => {

  /*
  it("runs a flow a simple flow with hardcoded inputs", async () => {
    const code = `
function init(setup) {
    // We keep this empty on purpose of the test
}

async function run(services) {
	const prompt = services.input("user");
  console.log("Echoing", prompt);	
	services.output("echo", "Echo: " + prompt);
}
`;

    const flow = new Flow(code);
    await flow.setup();
    const result = await flow.run({ user: "Say something" });
    expect(result.get("echo")).toBe("Echo: Say something");
  });
  */
  
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
    const spec = await flow.setup();
    expect(spec.title).toBe("Echo");
    expect(spec.inputs[0].label).toBe("Say something");

    const result = await flow.run({ user: "Say something" });
    expect(result.get("echo")).toBe("Echo: Say something");
  });

  /*
  it("runs with a chained setup", async () => {
    const code = `
function init(setup) {
	setup
		.title("Echo")
		.inText("user", "Say something")
		.outText("echo")
}

async function run(services) {
	const prompt = services.input("user");
  console.log("Echoing", prompt);	
	services.output("echo", "Echo: " + prompt);
}
`;

    const flow = new Flow(code);
    await flow.setup();
    const result = await flow.run({ user: "Say something" });
    expect(result.get("echo")).toBe("Echo: Say something");
  });

  it("runs a flow with a use of services.img", async () => {

    const code = `
function init(setup) {
  setup
    .title("Create any image")
    .inText("prompt", "An image to create")
    .outImg("img")
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
  */

});