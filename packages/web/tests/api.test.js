import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  apiError,
  createFileResponse,
  readJsonObject,
  readMultipartFiles,
  requireUser,
} from "../src/lib/server/api.ts";

test("streams workspace files with private, sandboxed response headers", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-file-response-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const absolutePath = path.join(directory, "report.txt");
  await fs.writeFile(absolutePath, "hello");
  const response = createFileResponse({
    absolutePath,
    name: "my report.txt",
    mimeType: "text/plain",
    size: 5,
  });

  assert.equal(await response.text(), "hello");
  assert.equal(response.headers.get("content-type"), "text/plain");
  assert.equal(response.headers.get("content-length"), "5");
  assert.equal(response.headers.get("content-disposition"), "inline; filename*=UTF-8''my%20report.txt");
  assert.equal(response.headers.get("cache-control"), "private, max-age=60");
  assert.equal(response.headers.get("content-security-policy"), "sandbox");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

/** @param {unknown} error @returns {error is { status: number }} */
function hasStatus(error) {
  return (
    typeof error === "object"
    && error !== null
    && "status" in error
    && typeof error.status === "number"
  );
}

test("preserves expected HTTP errors from request validation", async () => {
  /** @type {unknown} */
  let validationError;
  try {
    await readJsonObject(new Request("http://heswe.local/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid",
    }));
  } catch (error) {
    validationError = error;
  }

  assert.ok(hasStatus(validationError));
  assert.equal(validationError.status, 400);
  assert.throws(
    () => apiError(validationError),
    (error) => error === validationError,
  );
});

test("rejects unauthenticated requests with 401", () => {
  assert.throws(
    () => requireUser({ session: null, user: null }),
    (error) => hasStatus(error) && error.status === 401,
  );
});

test("reads files from bounded multipart requests", async () => {
  const form = new FormData();
  form.append("files", new File(["hello"], "hello.txt", { type: "text/plain" }));
  const request = new Request("http://heswe.local/api/files", {
    method: "POST",
    body: form,
  });

  const files = await readMultipartFiles(request);

  assert.equal(files.length, 1);
  assert.equal(files[0].name, "hello.txt");
  assert.equal(await files[0].text(), "hello");
});

test("rejects multipart requests larger than the upload limit", async () => {
  const request = new Request("http://heswe.local/api/files", {
    method: "POST",
    headers: {
      "content-length": String(43 * 1024 * 1024),
      "content-type": "multipart/form-data; boundary=test",
    },
    body: "--test--\r\n",
  });

  await assert.rejects(
    readMultipartFiles(request),
    (error) => hasStatus(error) && error.status === 413,
  );
});
