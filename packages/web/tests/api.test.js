import assert from "node:assert/strict";
import test from "node:test";
import {
  apiError,
  readJsonObject,
  readMultipartFiles,
  requireUser,
} from "../src/lib/server/api.ts";

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
