# Release readiness, September 28

The local app now completes real responses and file-reading tool calls with seven providers. This pass fixes provider compatibility, tool history, settings admission, reconnect event handling, and narrow-screen layouts. Shared hosting still needs the deployment and lifecycle work listed below.

## Changed

- `apply_patch` now describes its arguments with an object schema accepted by Anthropic, DeepSeek, and Google. OpenAI's native patch payload remains supported.
- Tool history matches calls to results. Failed calls and calls with no result stay visible, including when a turn has no final reply. Assistant text alongside tool calls is preserved. Tool-only turns publish progress.
- Provider failures show fixed, actionable messages for rejected requests, invalid keys, credit limits, model access, unavailable models, and rate limits. Raw provider response bodies are not sent to the browser.
- Google defaults to `gemini-3.1-pro-preview`; Groq defaults to `openai/gpt-oss-120b`. Both completed live tool calls. Existing explicit model selections are preserved. Google's new default is a preview model.
- Settings edits are ordered. They drain accepted messages before writing, block new messages during runtime reset, and invalidate the cached runtime even after a failed write. Shutdown closes message admission and drains accepted requests once. Invalid key input is validated before any settings files are created.
- Each event-stream connection requests workspace, cached-thread, and file snapshots. Overlapping event refreshes for the same resource are coalesced with a trailing refresh so a later invalidation is not lost. Stale errors from a different workspace are ignored.
- Provider settings wrap on narrow screens. Mobile navigation opens as a drawer, closes when a conversation is selected, and leaves the conversation at full width. Tool previews truncate without pushing their status outside the row. Chat scrolling tolerates small distances from the bottom.

## Validation

Using the installed Node.js 22.20 runtime on macOS:

- 211 tests pass, including 15 new regression tests.
- Both frontend checks pass with zero errors and warnings.
- The production build passes. Existing dependency cycles, bundle-size warnings, and a dependency CSS nesting warning remain.
- Browser checks covered login, saved conversation history, tool status rendering, desktop and 390px layouts, mobile drawer navigation, and provider settings.
- Browser reconnect recovery is **not verified**. The first offline experiment did not show the missed thread after restoring networking; builds and hot reloads overlapped that check. A second fixture-creation request was declined. Network emulation was restored. Automated connection-event and coalescing tests pass, but a controlled browser reconnect check remains required.

The default shell used Node 26 with a SQLite binary built for Node 22, causing an initial 500. Running the matching installed Node 22 runtime resolved that environment issue. Rebuild native dependencies when changing Node major versions.

## Live providers

Each successful check saved the provider/model through the HTTP settings API, read the saved selection back, created a thread, asked the real agent to read a known file in the test workspace, and verified both its contents in the answer and a completed tool result. These checks used the process worker, not gVisor. Copied provider keys were removed from the test workspace after each run.

| Provider | Model | Result |
| --- | --- | --- |
| OpenRouter | `openai/gpt-4.1-mini` | Response and tool call passed. The existing `openai/gpt-5.4` default exceeded this key's credit allowance for a 32,000-token reservation. |
| OpenAI | `gpt-5.4` | Response and tool call passed. |
| Anthropic | `claude-sonnet-4-6` | Response and tool call passed after the tool schema fix. |
| Google | `gemini-3.1-pro-preview` | Response and tool call passed after the schema fix. The previous `gemini-2.5-pro` default was unavailable for this account. |
| Groq | `openai/gpt-oss-120b` | Response and tool call passed. The previous Llama default was unavailable for this account. |
| xAI | `grok-4-1-fast` | Response and tool call passed. |
| DeepSeek | `deepseek-chat` | Response and tool call passed after the tool schema fix. |
| Mistral | `mistral-large-latest`, `mistral-small-latest` | Large was denied by the subscription tier; Small hit a rate limit. Neither is verified. The pinned model catalog also warns about these aliases. |
| Cohere | `command-r-plus` | API rejected AIWrapper's `preamble_override` field. Needs an adapter fix and retest. |
| Kimi | `kimi-k2.5` | API rejected the available key at the configured Moonshot China endpoint. Check account region and endpoint before retrying. |

Provider model references: [Google Gemini 3.1 Pro](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview), [Groq supported models](https://console.groq.com/docs/models). Live results above are from this checkout and these accounts, not claims that every account has the same access.

## Remaining release gates

- Repeat browser reconnect coverage in a stable server session. Also verify missed updates to an already open thread and file listing, and attachment retry across workspace switches.
- Build and run the image on Linux with gVisor; verify container stop/removal, worker draining, bounded protocol traffic, and network policy.
- Add service eviction and application shutdown ownership. This pass fixes admission inside an individual service, not the process-wide service cache or Docker cleanup.
- Settings writes are ordered but not a multi-file transaction. Filesystem failure can leave a partial update; runtime invalidation prevents continuing with a stale cached agent. Define recovery before promising transactional settings.
- Add the interim `sila_` to `heswe_` database migration before supporting upgrades from that build.
- Resolve the remaining provider failures and publish pinned dependency commits before expecting a fresh clone to work elsewhere.
- Add CI and a persistent browser interaction suite. Keep history recovery and concurrent filesystem mutation limitations from the [September 26 review](review-2026-09-26.md) on the release list.
- Slack and Telegram still need the shared sandbox boundary. Provider keys remain readable inside workspaces until the inference broker exists.

## Decisions for the release owner

1. Is the first release a local/private alpha or a shared hosted service? The hosted boundary has additional gates above.
2. Should the default optimize for quality or cost? OpenRouter's current GPT-5.4 default hit the available key's credit allowance, while GPT-4.1 mini passed. Is a preview Google model acceptable as the new default?
3. Which providers are promised at launch? Seven passed here; Cohere, Kimi, and Mistral need follow-up.
4. Does the mobile drawer and per-step tool history feel right? Review the live-tested threads in the local “Release verification” workspace. The model field is still free text; a searchable model picker is a separate product decision.
