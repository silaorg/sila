import { Flow } from "@sila/core";
import { describe, it, expect } from "vitest";

describe("Flow simple test", () => {

  it("should execute a flow", async () => {
    
    /*
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
*/

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
	services.outputs("echo", "Echo: " + prompt);
}
`;

    const flow = new Flow(code);
    await flow.setup();
    const result = await flow.run({ user: "Say something" });
    expect(result.get("echo")).toBe("Echo: Say something");
  });
});