### `read` tool for workspace files

Goal: extend the existing `read` tool so `WrapChatAgent` can read not only remote URLs but also text files stored in the current space (workspace) and in the current chat’s files tree, using simple `file:` URIs.

---

## URI formats

- **Workspace-level files** (space `assets` tree):
  - **Format**: `file:///assets/brand.md`
  - **Semantics**:
    - `file:///` means “resolve from the current `Space` root”.
    - The first segment after the leading slash is a named child under `Space.rootVertex` (for example, `assets`).
    - The rest of the path segments navigate children by `name` (`Vertex.name`) until a file vertex is reached.
  - **Use cases**:
    - Brand docs, guidelines, system docs shared across chats in the same space.
    - “Static” reference documents for agents (for example, `file:///assets/policies/security.md`).

- **Chat-level files** (current thread files tree):
  - **Format**: `file:document.md`
  - **Semantics**:
    - `file:` with no `//` means “resolve relative to the current chat thread”.
    - Resolution happens under the current chat `AppTree`’s `files` subtree (same root as `ChatAppData.getFilesRoot(true)` and attachments saved via `ChatAppData.newMessage` and `resolveFileTarget`).
    - The path part after `file:` is a slash-separated path relative to this chat `files` root:
      - `file:document.md` → `files/document.md`
      - `file:notes/project-a.md` → `files/notes/project-a.md`.
  - **Use cases**:
    - Letting the agent read user-attached `.md` / `.txt` files in the current thread.
    - Treating chat files as a lightweight “project FS” for the agent.

- **Future-compatible**:
  - We can later support more explicit forms like `file://space/assets/brand.md` or `file://thread/notes.md` if we introduce more scopes, but MVP keeps the syntax minimal.

---

## Resolution strategy

### Detecting schemes

- The existing `read` tool currently:
  - Extracts `scheme = uri.split('://')[0]`.
  - Requires a scheme and always calls `proxyFetch(uri)` → HTML → Defuddle → markdown.
- New behavior:
  - The `read` tool continues to call a single **fetch-like** function.
  - A **workspace-aware fetch wrapper** will detect `file:` URIs and resolve them inside the current space/chat before falling back to normal HTTP fetching.

### Workspace-level resolution (`file:///...`)

- **Inputs**:
  - `Space` instance (from `AgentServices.space`) must be passed into or accessible from `getToolRead`’s handler.
  - Parsed URI path, e.g. `/assets/brand.md`.
- **Steps**:
  1. Strip the `file://` prefix and keep the path, for example `"/assets/brand.md"`.
  2. Split into segments: `["assets", "brand.md"]`.
  3. Starting from `space.rootVertex`, walk down children by `name`:
     - First segment `assets` must match a named child (`root.newNamedChild('assets')` from `Space.newSpace`).
     - Subsequent segments match `child.name` (`Vertex.name`).
  4. When reaching the final vertex, treat it as a file vertex and read its bytes from CAS:
     - Use `FileResolver.resolveVertexToFileReference` or a small helper to convert the file vertex into `{ hash, mimeType, size, ... }`.
     - Use `space.fileStore` to access the CAS:
       - `const store = space.fileStore;`
       - `const bytes = await store.getBytes(hash);`
  5. Convert bytes to text:
     - Support at least `text/*` and `application/json` and `application/markdown` MIME types.
     - Decode `Uint8Array` using `TextDecoder("utf-8")`.
  6. Return text directly from the tool.
- **Failure modes**:
  - If any segment is missing: throw a clear error like `"Workspace file not found at /assets/brand.md"`.
  - If the target vertex has no `hash` or mime type is not textual: either
    - Return an error that it is not a text file, or
    - Return a short description, not the raw bytes (MVP: error).

### Chat-level resolution (`file:...`)

- **Inputs**:
  - Current chat context (thread app tree ID) needs to be available to the `read` tool handler.
  - Parsed URI path after `file:`, for example `"document.md"` or `"folder/doc.md"`.
- **Steps**:
  1. Take the path part after `file:` and normalize it to a path under the current chat `files` root:
     - `"document.md"` → segments `["files", "document.md"]`.
     - `"notes/project-a.md"` → segments `["files", "notes", "project-a.md"]`.
  2. Load the current chat `AppTree`:
     - The agent already has an `AppTree` instance in `WrapChatAgent` constructor.
  3. Resolve a folder/file path under that tree:
     - Reuse logic similar to `ChatAppData.ensureFolderPathInTree`, but without creating folders:
       - Start at the tree’s named `files` vertex (`appTree.tree.getVertexByPath('files')`).
       - Walk segments by `name`.
       - Return the final vertex if it exists, otherwise error.
     - Alternatively, share a helper with `FilesTreeData.ensureFolderPath` but with a `createIfMissing=false` option.
  4. Once a file vertex is found, use the same “vertex→hash→CAS→text” pipeline as for workspace-level files.
  5. Return text from the tool.
- **Failure modes**:
  - If the chat has no `files` vertex or path is missing: error like `"Chat file not found at files/notes/project-a.md"`.
  - If file is not textual: same behavior as workspace-level.

---

## Integration points

### `toolRead.ts`

- **Current**:

```ts
const res = await proxyFetch(uri);
// ... HTML → Defuddle → markdown ...
```

- **Proposed**:
  - Make `getToolRead` depend on an injected fetch implementation:

    ```ts
    export function getToolRead(fetchImpl: ProxyFetch = proxyFetch): LangToolWithHandler {
      // handler calls fetchImpl(uri) instead of proxyFetch(uri)
    }
    ```

  - `getToolRead` remains unaware of spaces, app trees, or CAS. It only knows that `fetchImpl` can handle:
    - `file:` URIs, returning a `Response` whose `text()` is the file content.
    - `http(s)`/`sila://` URIs, returning HTML that is passed through Defuddle as today.
  - Tool parameters exposed to the model stay as `{ uri: string }`; workspace context is provided by the backend via the injected fetch.

### Workspace-aware fetch wrapper

- Add a small helper, for example:

```ts
function createWorkspaceProxyFetch(space: Space, appTree?: AppTree): ProxyFetch {
  return async (url, init) => {
    if (url.startsWith('file:')) {
      const text = await resolveWorkspaceFileUrl(url, space, appTree);
      return new Response(text, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
    // Fallback to environment-level proxy for HTTP/S and sila://
    return proxyFetch(url, init);
  };
}
```

- `resolveWorkspaceFileUrl` encapsulates the logic from the previous sections:
  - `file:///assets/brand.md` → workspace-level resolution via `Space` and CAS.
  - `file:document.md` → chat-level resolution via `AppTree.files` and CAS.
- This keeps workspace concerns outside `toolRead.ts` and lets other features reuse the same workspace-aware fetch if needed.

### `WrapChatAgent` and `AgentServices`

- `AgentServices.getToolsForModel` currently does `tools.push(getToolRead());`.
- To support workspace resolution without complicating the tool itself:
  - Construct a workspace-aware fetch in the chat backend or agent:

    ```ts
    const fetchForAgent = createWorkspaceProxyFetch(space, appTree);
    const readTool = getToolRead(fetchForAgent);
    ```

  - Include `readTool` in `availableTools` alongside other tools.
- This wiring:
  - Gives the `read` tool full access to workspace and chat files via `file:` URIs.
  - Keeps `AgentServices`, `WrapChatAgent`, and `ChatAppBackend` as the place where `Space`/`AppTree` context is known.

### Using CAS (`FileStore`) and file metadata

- We already have:
  - `Space.fileStore: FileStore | null` → CAS backend.
  - `FilesTreeData.saveFileInfoFromAttachment` and `FileResolver` for mapping file vertices to URLs and bytes.
- For this proposal:
  - Reading workspace/chat text files will use `FileStore.getBytes(hash)` and `TextDecoder`.
  - We should keep MIME-type checking consistent with how files are stored in `FilesTreeData` and `ChatAppData.newMessage`.

---

## Encoding and text handling

- **Supported encodings**:
  - MVP: assume UTF‑8 for all text files in CAS.
  - We can infer encoding from MIME parameters later if needed.
- **Markdown vs. plain text**:
  - For `file:` URIs, we should **not** run Defuddle; we already have clean text.
  - If a file is markdown (`.md` or mime `text/markdown`), return its raw markdown; the model understands it.
  - Non-markdown text (for example, `.txt`, `.json`) is returned as-is.

---

## Errors, safety, and limitations

- **Scope**:
  - `file:` URIs are **limited to the current space and current chat**; there is no way to escape to host OS paths.
  - This keeps the agent sandboxed inside the Sila workspace.
- **Error reporting**:
  - Tool should return clear error messages:
    - Invalid scheme (`file` without path).
    - Path not found.
    - File is not textual or is too large.
  - We can cap file size (for example, 256 KB or 1 MB) to avoid huge tool responses.
- **Non-text files**:
  - For now, the `read` tool focuses on text; images and binaries stay as attachments and are consumed via vision models rather than `read`.

---

## Minimal implementation plan

- **1) Introduce workspace-aware fetch**:
  - Implement `createWorkspaceProxyFetch(space: Space, appTree?: AppTree): ProxyFetch`.
  - Inside it, detect `file:` URIs and call:
    - `resolveWorkspaceFile(uri, space)` for `file:///...`.
    - `resolveChatFile(uri, appTree)` for `file:...`.
  - For other schemes, delegate to the existing `proxyFetch`.

- **2) Make `getToolRead` injectable**:
  - Change `getToolRead` to accept a `ProxyFetch` argument and use that instead of calling `proxyFetch` directly.
  - Update `AgentServices` / `WrapChatAgent` to pass a workspace-aware fetch when constructing the `read` tool.

- **3) Implement path resolution helpers**:
  - In a shared utility (for example, under `spaces/files`):
    - `resolveSpacePathToFileVertex(space, segments): Vertex | null` (no creation).
    - `resolveChatFilesPathToFileVertex(appTree, relativePath): Vertex | null`.

- **4) Implement CAS → text helper**:
  - `readTextFromFileVertex(space, fileVertex): Promise<string>`:
    - Get hash and mime type.
    - Fetch bytes from `FileStore`.
    - Decode with `TextDecoder('utf-8')`.
    - Reject if mime is not `text/*` or known text-like types.

- **5) Tests and UX**:
  - Add core tests:
    - Reading `file:///assets/brand.md` when the file exists / missing / non-text.
    - Reading `file:document.md` in a chat with/without a `files` vertex.
  - Optionally add a small doc in user-facing “How to use AI” showing example prompts:
    - “Read `file:///assets/brand.md` and summarize our brand voice.”
    - “Compare `file:requirements.md` and `file:design.md` and list conflicts.”


