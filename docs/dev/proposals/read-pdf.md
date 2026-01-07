### Read PDFs with the `read` tool

Goal: let the agent `read` tool return text from PDF files.

This proposal picks the quickest, simplest approach.
It builds on the existing `read` tool and workspace-aware fetch.

---

## Quickest approach

- Add a small PDF text extractor to `toolRead`.
- Keep the `read` tool API the same (`{ uri: string }`).
- Treat `application/pdf` as a supported content type.
- Parse the PDF into plain text.
- Return the text to the model.

---

## Why this is the simplest

- The `read` tool already fetches files as bytes.
- Workspace files already store `mimeType`.
- We only need one new dependency in `@sila/core`.
- No UI changes are needed.

---

## Proposed implementation

### 1) Add a PDF parser dependency

Use `pdfjs-dist` because it is battle tested and ESM-ready.
It works in Node and browser runtimes.

Use the `legacy` build to avoid bundler warnings in Node.
The default build assumes worker globals that are not present in tests.
The legacy entry works without extra worker setup.

Add to `packages/core/package.json`:

```json
"dependencies": {
  "pdfjs-dist": "^4.x"
}
```

---

### 2) Extend `toolRead` to detect PDFs

Location: `packages/core/src/agents/tools/toolRead.ts`.

Add a PDF branch before the text-only check.

Pseudo-code:

```ts
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

if (contentType.includes("application/pdf")) {
  const bytes = new Uint8Array(await res.arrayBuffer());
  return await extractPdfText(bytes, uri);
}

if (contentType && !isTextLikeMime(contentType)) {
  throw new Error("Cannot read binary file...");
}
```

Add a helper in the same file:

```ts
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 50;

async function extractPdfText(bytes: Uint8Array, uri: string) {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error(`PDF too large for read tool (size=${bytes.byteLength})`);
  }

  const pdf = await getDocument({ data: bytes }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];

  for (let page = 1; page <= pageCount; page += 1) {
    const pageData = await pdf.getPage(page);
    const text = await pageData.getTextContent();
    const pageText = text.items.map((item) => "str" in item ? item.str : "").join(" ");
    parts.push(`\n\n# Page ${page}\n${pageText}`);
  }

  if (pdf.numPages > MAX_PDF_PAGES) {
    parts.push(`\n\n# Note\nStopped at page ${MAX_PDF_PAGES} of ${pdf.numPages}.`);
  }

  return parts.join("\n").trim();
}
```

---

### 3) Keep workspace file handling unchanged

- `createWorkspaceProxyFetch` already returns bytes for PDFs.
- The `read` tool will parse the PDF bytes itself.

No changes are needed in `workspaceProxyFetch.ts`.

---

## Error handling

- Fail if the PDF is larger than `MAX_PDF_BYTES`.
- Stop after `MAX_PDF_PAGES`.
- Return clear errors for invalid PDFs.

---

## Tests (optional for MVP)

Add a small unit test under `packages/core/tests/src/tools`.
Use a tiny PDF fixture.
Verify:
- PDF text is returned.
- Large PDFs fail with a clear error.

---

## Alternatives considered

- **Server-side PDF extraction**.
  This needs a new service and more plumbing.
- **OCR for scanned PDFs**.
  This adds a heavy dependency and is not needed for MVP.

---

## Expected effort

- 1 new dependency.
- 1 file change in `toolRead`.
- Optional test.

This is the fastest path to PDF support.
