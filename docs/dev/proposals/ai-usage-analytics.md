# AI usage analytics

This proposal sketches a lightweight, **server-only** service that listens to aiwrapper responses, captures usage data, and stores it in a local SQLite store so we can monitor costs outside the Electron UI.

## Goals

1. Capture every aiwrapper inference (chat completion, tool request, etc.) on the server side without touching the desktop renderer.
2. Keep raw usage data in an append-only SQLite table so we can aggregate, visualize, or bill later.
3. Provide a minimal API for other services to consume total spend, per-model statistics, and raw records.

## How we capture data

- aiwrapper already drives our inference (agents, tools, chat tools). The server process that shells into aiwrapper should subscribe to whatever “response” hook it exposes (for example, language provider `onResponse` or a middleware on `LanguageProvider` that receives `LangMessage` / `ToolResult` objects).
- Each response typically carries metadata: provider name, model id, the prompt/responses, and—if we spot it—cost and token usage fields emitted by the specific provider. If the provider returns `usage` or `total_cost`, copy that directly. Otherwise, fall back to a simple token counter (or `tiktoken`-like helper) and our pricing catalog to estimate.
- The subscription callback should only fire once per inference, create an `AiUsageRecord` object, and forward it to the storage layer. The rest of the aiwrapper lifecycle remains unchanged.

Example sketch:

```ts
interface AiUsageRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost?: number;
  outputCost?: number;
  reportedCost?: number;
  inferenceId: string;
  createdAt: Date;
}

aiwrapper.onResponse((response) => {
  const usage = extractUsage(response);
  storage.insert(usage);
});
```

## Pricing and storage

- Keep a small catalog in code (JSON, env, or SQLite lookup) that dots prices per model/provider. When aiwrapper gives token counts but no cost, multiply by that catalog to produce `inputCost`/`outputCost`.
- Store records in SQLite. One plain table with columns mirroring `AiUsageRecord` and an index on `createdAt` should be enough to start. SQLite is fast, file-based, and can be read by diagnostics or reporting scripts later.
- Store the records alongside the aiwrapper server data (outside of the front-end). The service can expose a tiny CLI or RPC to dump aggregates for dashboards or billing scripts.

## API surfaces

1. **Ingestion** – the internal subscription above is the only write API. It can be wrapped in a small helper that normalizes aiwrapper responses before inserting, which keeps the rest of the stack ignorant of storage details.
2. **Read API** – expose a query shim (HTTP, gRPC, or even a CLI): `GET /usage/summary?from=&to=` and `GET /usage/records?limit=`. Each endpoint can read from the SQLite table and optionally join with pricing metadata so dashboards see a total cost column.
3. **Hooks for future uses** – as a first step we can also emit events when a single inference crosses a cost threshold (e.g., `totalCost > $0.5`), so other services can react.

## Next steps

1. Prototype a small `ai-usage-service` inside the server workspace that depends on aiwrapper, opens the SQLite DB, and registers the response subscriber.
2. Figure out how aiwrapper surfaces metadata in our current usage (maybe inspect `LanguageProvider` responses in `packages/core`). Confirm what fields are available without patching the providers.
3. Decide on the door for reading the data (CLI, HTTP route, etc.) and stub the query API for early dashboards.
4. Wire a simple pricing catalog (JSON or env) and ensure we always log a `totalCost`, even when aiwrapper only reports tokens.

This sketch can evolve into a full analytics pipeline once we need more visibility into our inference spend.
