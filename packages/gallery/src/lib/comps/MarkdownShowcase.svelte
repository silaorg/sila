<script lang="ts">
  import { Markdown } from "@markpage/svelte";
  import { chatMarkdownOptions } from "@sila/client/comps/markdown/chatMarkdownOptions";
  import ClientStateProvider from "@sila/client/state/ClientStateProvider.svelte";

  const markdownSource = String.raw`# Markdown Showcase

## Inline Formatting

We support **bold**, _italic_, and ~~strikethrough~~ text. You can also combine them, like **_bold italic_**.

Links work too: [Visit Sila](https://silain.com).

> Blockquotes help highlight important notes.

## Lists

- Item one
- Item two
  - Nested item
- Item three

1. First ordered item
2. Second ordered item
3. Third ordered item

## Tables

| Feature | Status | Notes |
| --- | --- | --- |
| Markdown | ✅ | Supports tables |
| Math | ✅ | Uses LaTeX |
| Code blocks | ✅ | Highlighted with titles |

## Code Blocks

~~~js title="fibonacci.js"
export function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}
~~~

~~~bash title="install.sh"
npm install
npm run dev
~~~

Inline code looks like \`const state = $state(0);\`.

## Math

Inline math: $E = mc^2$.

Block math:

$$
\oint_{\partial \Sigma} \mathbf{B} \cdot d\mathbf{l} = \mu_0 \left( I_\text{enc} + \varepsilon_0 \frac{d\Phi_E}{dt} \right)
$$

## Images

![Sila Logo](https://silain.com/images/og-image.png)

## Horizontal Rule

---

Enjoy exploring how markdown renders in Sila!`;
</script>

<div class="prose max-w-none">
  <ClientStateProvider>
    <Markdown source={markdownSource} options={chatMarkdownOptions} />
  </ClientStateProvider>
</div>
