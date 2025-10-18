import { proxyFetch } from "@sila/core";
import { ToolWithHandler } from "aiwrapper";
import Defuddle from "defuddle/markdown";

export function getToolRead(): ToolWithHandler {
  return {
    name: 'read',
    description: 'Fetch and read a resource by its URI. It could be a URL of a website or an internal file in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'The URI should start with the scheme (http, https, sila, etc.)' }
      },
      required: ['uri']
    },
    handler: async (args: Record<string, any>) => {
      const { uri } = args;

      // Find a scheme in the URI
      const scheme = uri.split('://')[0];
      if (!scheme) {
        throw new Error('Invalid URI, needs to start with a scheme, such as https://');
      }

      const res = await proxyFetch(uri);
      if (!res.ok) {
        throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
      }
      const html = await res.text();

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const defuddle = new Defuddle(doc, { url: uri, separateMarkdown: true });
      const parsed = defuddle.parse();
      return parsed.contentMarkdown || parsed.content || '';
    }
  }
}