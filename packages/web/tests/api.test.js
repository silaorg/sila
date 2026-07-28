import assert from "node:assert/strict";
import test from "node:test";
import {
  apiError,
  readJsonObject,
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
