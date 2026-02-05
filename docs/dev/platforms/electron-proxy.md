# Electron Streaming Proxy for AI Providers

To support local AI providers (like Ollama running on `localhost`) and ensure robust streaming for all AI interactions within the restricted Electron Renderer environment, Sila implements a custom streaming proxy mechanism.

## The Problem

### 1. CORS Restrictions
Browsers (and Electron's Renderer process) enforce Cross-Origin Resource Sharing (CORS) security policies. When the Sila app (served from `sila://` or `http://localhost`) tries to fetch resources from another local server (like Ollama at `http://localhost:11434`), the browser blocks the request unless the server explicitly allows it. Many local AI tools do not configure CORS headers by default.

### 2. IPC Serialization Limits
Electron's Inter-Process Communication (IPC) allows the Renderer to ask the Main process to do things (like make a network request). However, IPC messages must be serializable (JSON-compatible).
- **`AbortSignal`**: Standard `fetch` uses `AbortSignal` to cancel requests. This object cannot be sent over IPC.
- **`ReadableStream`**: The response body of a streaming LLM request is a `ReadableStream`, which also cannot be directly passed through IPC without special handling.

## The Solution

Sila implements a **Main Process Proxy** that handles the actual network requests. The Renderer communicates with this proxy via a custom protocol that supports streaming.

### Architecture

1.  **Renderer**: Instead of calling `fetch()` directly, the app calls `window.desktopNet.proxyFetch()`.
2.  **IPC Bridge (`preload.js`)**: This bridge sanitizes the request options (e.g., stripping `AbortSignal`) and invokes the Main process handler.
3.  **Main Process (`main-electron.js`)**:
    -   Receives the URL and options.
    -   Executes the native Node.js `fetch` (which has no CORS restrictions).
    -   Generates a unique `streamId`.
    -   Immediately returns the response metadata (status, headers) and the `streamId` to the Renderer.
    -   **Streaming**: It listens to the response body stream and emits chunks as IPC events to a unique channel: `sila:stream:${streamId}`.
4.  **Renderer Reconstruction (`main.ts`)**:
    -   Receives the metadata and `streamId`.
    -   Constructs a new `ReadableStream`.
    -   Subscribes to the IPC channel `sila:stream:${streamId}`.
    -   Enqueues received data chunks into the stream controller.
    -   Returns a standard `Response` object wrapping this custom stream.

## Implementation Details

### `aiwrapper` Injection

We use `aiwrapper`'s `setHttpRequestImpl` to inject this custom proxy logic globally for all AI requests. This ensures that whether we are connecting to OpenAI, Anthropic, or a local Ollama instance, the request goes through our robust proxy.

```typescript
// packages/desktop/src/main.ts

setHttpRequestImpl(async (url, options) => {
  // Route ALL requests through the safe proxy to bypass CORS and handle streaming
  return safeProxyFetch(url, options);
});
```

### Safety: `AbortSignal`

The `safeProxyFetch` wrapper explicitly removes the `signal` property from the `init` object before passing it to IPC, preventing serialization crashes.

```typescript
const { signal, ...safeOptions } = init || {};
const r = await (window as any).desktopNet.proxyFetch(url, safeOptions);
```

### Streaming Logic

**Main Process:**
```javascript
// ... fetch ...
const streamId = randomUUID();
for await (const chunk of res.body) {
  event.sender.send(`sila:stream:${streamId}`, 'data', new Uint8Array(chunk));
}
event.sender.send(`sila:stream:${streamId}`, 'end');
```

**Renderer:**
```javascript
const body = new ReadableStream({
  start(controller) {
    desktopNet.onStreamEvent(streamId, (type, data) => {
      if (type === 'data') controller.enqueue(data);
      // ... handle end/error
    });
  }
});
```
