declare module "markdown-link-check" {
  export type LinkCheckResult = {
    link: string;
    status: "alive" | "dead" | "ignored" | "error" | string;
    statusCode?: number;
  };

  export type MarkdownLinkCheckOptions = {
    baseUrl?: string;
    ignorePatterns?: Array<{ pattern: RegExp }>;
    showProgressBar?: boolean;
  };

  export type MarkdownLinkCheckCallback = (
    err: unknown,
    results: LinkCheckResult[]
  ) => void;

  /**
   * markdown-link-check(content, options, callback)
   * We only type what we use in this repo.
   */
  export default function markdownLinkCheck(
    markdown: string,
    options: MarkdownLinkCheckOptions,
    callback: MarkdownLinkCheckCallback
  ): void;
}

