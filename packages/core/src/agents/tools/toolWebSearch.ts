import type { LangToolWithHandler } from "aiwrapper";
import type { AppTree } from "../../spaces/AppTree";
import type { AgentTool } from "./AgentTool";
import { proxyFetch } from "../../utils/proxyFetch";

interface WebSearchResult {
  title: string;
  url: string;
  snippet?: string;
  publishedDate?: string;
  author?: string;
}

interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
}

export const toolWebSearch: AgentTool = {
  name: "web_search",
  description:
    "Search the web for up-to-date information and return a list of relevant results with titles, URLs, and snippets.",
  canUseTool(services) {
    return Boolean(services.space.getServiceApiKey("exa"));
  },
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query to look up on the web.",
      },
      num_results: {
        type: "number",
        description: "Optional number of results to return (default: 5).",
      },
    },
    required: ["query"],
  },
  getTool(services, _appTree: AppTree): LangToolWithHandler {
    const space = services.space;
    return {
      name: this.name,
      description: this.description!,
      parameters: this.parameters!,
      handler: async (args: Record<string, any>): Promise<WebSearchResponse> => {
        const query = args.query as string | undefined;
        const numResults = args.num_results as number | undefined;

        if (!query || typeof query !== "string") {
          throw new Error("web_search requires a non-empty query string");
        }

        const apiKey = space.getServiceApiKey("exa");
        if (!apiKey) {
          throw new Error(
            "Exa API key not configured. Please configure Exa in the provider settings.",
          );
        }

        const limit = Math.max(1, Math.min(numResults ?? 5, 10));

        const response = await proxyFetch("https://api.exa.ai/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            query,
            numResults: limit,
            type: "neural",
            useAutoprompt: true,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `Exa search failed: ${response.status} ${response.statusText} ${errorBody}`,
          );
        }

        const data = await response.json();
        const results = Array.isArray(data.results) ? data.results : [];

        const normalizedResults: WebSearchResult[] = results.map((result: any) => {
          const title = result.title ?? result.url ?? "Untitled";
          const url = result.url ?? "";
          const snippet =
            result.text ??
            (Array.isArray(result.highlights)
              ? result.highlights.join(" ")
              : undefined);

          return {
            title,
            url,
            snippet,
            publishedDate: result.publishedDate,
            author: result.author,
          };
        });

        return {
          query,
          results: normalizedResults,
        };
      },
    };
  },
};
