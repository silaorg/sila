# Flow Files

Flow files (`.flow.js`) define executable pipelines that process inputs and produce outputs using AI services.

## Structure

A flow file has two functions:

### `init(setup)`

Defines the flow's metadata: title, description, inputs, and outputs.

```js
function init(setup) {
  setup.title("Logo to image");
  setup.describe("A pipeline that allows to add a logo to any image");
  
  setup.inImg("img-a", "A logo");
  setup.inImg("img-b", "Any photo where the logo is going to be inserted");
  setup.inText("prompt", "Additional prompt for the image", { optional: true });
  
  setup.outImgs("img-out", "Results");
}
```

**Flow API:**
- `setup.title(string)` - Flow title
- `setup.describe(string)` - Flow description
- `setup.inImg(id, label, options?)` - Image input (options: `{ optional: true }`)
- `setup.inText(id, label, options?)` - Text input (options: `{ optional: true }`)
- `setup.outImgs(id, label)` - Image output

### `run(services)`

Executes the flow using provided services.

```js
async function run(services) {
  const imgA = services.inputs["img-a"];
  const imgB = services.inputs["img-b"];
  const prompt = services.inputs["prompt"];
  
  const finalPrompt = [
    "Combine the images; the first image is a logo that has to be inserted in the second image",
    prompt
  ].join('\n\n');
  
  const result = await services.img([imgA, imgB], finalPrompt);
  
  services.outputs("img-out", result);
  
  return result;
}
```

**Services API:**
- `services.inputs[id]` - Access input values by ID
- `services.outputs(id, value)` - Set output values
- `services.img(images, prompt, options?)` - Image generation service
- `services.agent(messages, systemPrompt?)` - AI agent service
- Other services as registered

## Usage

Flows are executed in two phases:

1. **Inspect** - Calls `init(setup)` to extract metadata (title, description, inputs)
2. **Run** - Calls `run(services)` with provided inputs and services

## Example

```js
function init(setup) {
  setup.title("Image filter");
  setup.describe("Apply a filter to an image");
  setup.inImg("source", "Source image");
  setup.outImgs("result", "Filtered image");
}

async function run(services) {
  const source = services.inputs["source"];
  const result = await services.img([source], "Apply vintage filter");
  services.outputs("result", result);
  return result;
}
```

## Testing Flows
- Use the `test_flow` tool to run a `.flow.js` file with simulated services.  
- Provide the file path plus sample inputs:  
  `test_flow { "path": "file:flows/logo.flow.js", "inputs": { "img-a": { "kind": "file", "fileId": "sample" } } }`
- The simulated `services.img` returns a mock file reference and `services.agent` returns mock text. All values passed to `services.outputs(id, value)` are returned in the tool response so you can verify wiring without calling real backends.

