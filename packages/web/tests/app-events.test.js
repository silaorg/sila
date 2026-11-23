import assert from "node:assert/strict";
import test from "node:test";
import { AppEventBroker } from "../src/lib/server/app-events.ts";

test("aborting an active event request finishes a pending read", async () => {
  const broker = new AppEventBroker();
  const request = new AbortController();
  const response = broker.createResponse("user", request.signal);
  assert.ok(response.body);
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /event: connected/);

  const waiting = reader.read();
  request.abort();
  assert.equal((await waiting).done, true);
});
