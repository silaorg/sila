# Flow Files

Flow files (`.flow.js`) define executable pipelines that process inputs and produce outputs using AI services.

## Structure

A flow file has two functions:

### `setup(flow)`

Defines the flow's metadata: title, description, inputs, and outputs.

```js
function setup(flow) {
  flow.title("Logo to image");
  flow.describe("A pipeline that allows to add a logo to any image");
  
  flow.inImg("img-a", "A logo");
  flow.inImg("img-b", "Any photo where the logo is going to be inserted");
  flow.inText("prompt", "Additional prompt for the image", { optional: true });
  
  flow.outImgs("img-out", "Results");
}
```

**Flow API:**
- `flow.title(string)` - Flow title
- `flow.describe(string)` - Flow description
- `flow.inImg(id, label, options?)` - Image input (options: `{ optional: true }`)
- `flow.inText(id, label, options?)` - Text input (options: `{ optional: true }`)
- `flow.outImgs(id, label)` - Image output

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

1. **Inspect** - Calls `setup(flow)` to extract metadata (title, description, inputs)
2. **Run** - Calls `run(services)` with provided inputs and services

## Example

```js
function setup(flow) {
  flow.title("Image filter");
  flow.describe("Apply a filter to an image");
  flow.inImg("source", "Source image");
  flow.outImgs("result", "Filtered image");
}

async function run(services) {
  const source = services.inputs["source"];
  const result = await services.img([source], "Apply vintage filter");
  services.outputs("result", result);
  return result;
}
```

