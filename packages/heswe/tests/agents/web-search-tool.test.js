import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createToolWebSearch } from "../../src/agent-runtime/tools/web-search-tool.js";

describe("createToolWebSearch", () => {
  it("returns a clear error when EXA_API_KEY is missing", async () => {
    const previous = process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;

    try {
      const tool = createToolWebSearch();
      const result = await tool.handler({ query: "latest JS runtime news" });
      assert.equal(result.status, "failed");
      assert.match(result.error, /EXA_API_KEY/i);
    } finally {
      restoreEnv("EXA_API_KEY", previous);
    }
  });

  it("calls Exa search API and normalizes response data", async () => {
    const previousKey = process.env.EXA_API_KEY;
    const originalFetch = globalThis.fetch;

    process.env.EXA_API_KEY = "exa-test-key";
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.exa.ai/search");
      assert.equal(options.method, "POST");
      assert.equal(options.headers["x-api-key"], "exa-test-key");

      const body = JSON.parse(options.body);
      assert.equal(body.query, "heswe architecture");
      assert.equal(body.numResults, 10);
      assert.deepEqual(body.includeDomains, ["example.com"]);
      assert.equal(body.contents.text, true);
      assert.equal(body.contents.summary, true);

      return new Response(
        JSON.stringify({
          results: [
            {
              title: "Heswe Architecture",
              url: "https://example.com/heswe",
              publishedDate: "2026-02-20",
              author: "Heswe Team",
              score: 0.91,
              summary: "Short summary.",
              text: "Detailed article body.",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    };

    try {
      const tool = createToolWebSearch();
      const result = await tool.handler({
        query: "heswe architecture",
        numResults: 99,
        includeDomains: ["example.com", ""],
      });

      assert.equal(result.status, "ok");
      assert.equal(result.resultCount, 1);
      assert.equal(result.results[0].title, "Heswe Architecture");
      assert.equal(result.results[0].url, "https://example.com/heswe");
      assert.equal(result.results[0].summary, "Short summary.");
      assert.equal(result.results[0].excerpt, "Detailed article body.");
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv("EXA_API_KEY", previousKey);
    }
  });

  it("accepts an isolated workspace API key", async () => {
    const previousKey = process.env.EXA_API_KEY;
    const originalFetch = globalThis.fetch;
    delete process.env.EXA_API_KEY;
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers["x-api-key"], "workspace-exa-key");
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };

    try {
      const tool = createToolWebSearch({
        environment: { EXA_API_KEY: "workspace-exa-key" },
      });
      const result = await tool.handler({ query: "isolated search" });
      assert.equal(result.status, "ok");
      assert.equal(process.env.EXA_API_KEY, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnv("EXA_API_KEY", previousKey);
    }
  });
});

function restoreEnv(name, value) {
  if (typeof value === "string") {
    process.env[name] = value;
    return;
  }
  delete process.env[name];
}
