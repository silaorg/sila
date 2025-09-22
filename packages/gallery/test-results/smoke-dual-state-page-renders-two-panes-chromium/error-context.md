# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]: "[plugin:vite-plugin-svelte:compile]"
    - generic [ref=e6]: /workspace/packages/client/src/lib/comps/models/InputModel.svelte:9:2 Unexpected keyword 'const' https://svelte.dev/e/js_parse_error
  - generic [ref=e7]: InputModel.svelte:9:2
  - generic [ref=e8]: "7 | import { useClientState } from \"@sila/client/state/clientStateContext\"; 8 | import { 9 | const clientState = useClientState(); ^ 10 | splitModelString, 11 | isValidModelString,"
  - generic [ref=e9]:
    - text: Click outside, press
    - generic [ref=e10]: Esc
    - text: key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e11]: server.hmr.overlay
    - text: to
    - code [ref=e12]: "false"
    - text: in
    - code [ref=e13]: vite.config.ts
    - text: .
```