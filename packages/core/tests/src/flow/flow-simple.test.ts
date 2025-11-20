import { Flow } from "@sila/core";
import { describe, it, expect } from "vitest";

describe("Flow simple test", () => {

  it("should execute a flow", async () => {
    
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

    const flow = new Flow(code);
    await flow.setup();
    await flow.run();
    /*
    TODO:
    - [x] Write a simple flow that uses the flow API
    - [ ] Prepare the system to execute the flow
    - [ ] Execute the flow
    - [ ] Verify the result
    */

  });
});