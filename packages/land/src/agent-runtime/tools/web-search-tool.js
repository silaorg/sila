const EXA_SEARCH_ENDPOINT = "https://api.exa.ai/search";
const DEFAULT_RESULT_LIMIT = 5;
const MAX_RESULT_LIMIT = 10;
const EXCERPT_LIMIT = 900;

export function createToolWebSearch() {
  return {
    name: "web_search",
    description: "Search the web using Exa and return top results with short excerpts.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
        numResults: {
          type: "integer",
          description: `Number of results to return (1-${MAX_RESULT_LIMIT}).`,
        },
        includeDomains: {
          type: "array",
          items: { type: "string" },
          description: "Optional domains to include, for example ['openai.com'].",
        },
        excludeDomains: {
          type: "array",
          items: { type: "string" },
          description: "Optional domains to exclude.",
        },
      },
      required: ["query"],
    },
    handler: async ({ query, numResults, includeDomains, excludeDomains }) => {
      const normalizedQuery = typeof query === "string" ? query.trim() : "";
      if (!normalizedQuery) {
        return { status: "failed", error: "query must be a non-empty string." };
      }

      const apiKey = readApiKeyFromEnvironment();
      if (!apiKey) {
        return {
          status: "failed",
          error: "EXA_API_KEY is not configured. Set it in land .env or process env.",
        };
      }

      const payload = {
        query: normalizedQuery,
        numResults: toBoundedResultCount(numResults),
        type: "auto",
        contents: {
          text: true,
          summary: true,
        },
      };

      const safeIncludeDomains = toStringArray(includeDomains);
      if (safeIncludeDomains.length) {
        payload.includeDomains = safeIncludeDomains;
      }

      const safeExcludeDomains = toStringArray(excludeDomains);
      if (safeExcludeDomains.length) {
        payload.excludeDomains = safeExcludeDomains;
      }

      let response;
      try {
        response = await fetch(EXA_SEARCH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        return {
          status: "failed",
          error: `Exa web search request failed: ${error.message}`,
        };
      }

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        return {
          status: "failed",
          error: `Exa web search request failed with HTTP ${response.status}${details ? `: ${details}` : ""}`,
        };
      }

      let parsed;
      try {
        parsed = await response.json();
      } catch (error) {
        return {
          status: "failed",
          error: `Exa web search response is not valid JSON: ${error.message}`,
        };
      }

      const results = Array.isArray(parsed?.results)
        ? parsed.results.map((item) => ({
            title: toTextOrNull(item?.title),
            url: toTextOrNull(item?.url),
            publishedDate: toTextOrNull(item?.publishedDate),
            author: toTextOrNull(item?.author),
            score: toFiniteNumberOrNull(item?.score),
            summary: truncateText(item?.summary, EXCERPT_LIMIT),
            excerpt: truncateText(item?.text || toHighlightsText(item?.highlights), EXCERPT_LIMIT),
          }))
        : [];

      return {
        status: "ok",
        query: normalizedQuery,
        resultCount: results.length,
        results,
      };
    },
  };
}

function readApiKeyFromEnvironment() {
  if (typeof process.env.EXA_API_KEY !== "string") {
    return null;
  }
  const trimmed = process.env.EXA_API_KEY.trim();
  return trimmed.length ? trimmed : null;
}

function toBoundedResultCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_RESULT_LIMIT;
  }

  const rounded = Math.trunc(parsed);
  if (rounded < 1) {
    return 1;
  }
  if (rounded > MAX_RESULT_LIMIT) {
    return MAX_RESULT_LIMIT;
  }
  return rounded;
}

function toStringArray(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
}

function toHighlightsText(value) {
  if (!Array.isArray(value)) {
    return "";
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .join(" ");
}

function truncateText(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized.length) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function toTextOrNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toFiniteNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}
