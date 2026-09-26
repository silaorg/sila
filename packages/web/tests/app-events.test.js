import assert from "node:assert/strict";
import test from "node:test";
import { AppEventBroker } from "../src/lib/server/app-events.ts";

test("aborting an event subscription closes its pending read", { timeout: 1000 }, async () => {
  const broker = new AppEventBroker();
  const abort = new AbortController();
  const body = broker.createResponse("user-a", abort.signal).body;
  assert.ok(body);
  const reader = body.getReader();
  await reader.read(); // Initial connected event.
  const pending = reader.read();
  abort.abort();
  assert.deepEqual(await pending, { done: true, value: undefined });
  broker.publish({ type: "thread.changed", userId: "user-a" });
});

test("canceling a subscription does not affect another subscriber", async () => {
  const broker = new AppEventBroker();
  const abort = new AbortController();
  const firstBody = broker.createResponse("user-a", abort.signal).body;
  const secondBody = broker.createResponse("user-a", new AbortController().signal).body;
  assert.ok(firstBody);
  assert.ok(secondBody);
  const first = firstBody.getReader();
  const second = secondBody.getReader();
  await first.read();
  await second.read();
  await first.cancel();
  abort.abort();
  broker.publish({ type: "thread.changed", userId: "user-a", threadId: "thread" });
  const event = new TextDecoder().decode((await second.read()).value);
  assert.match(event, /thread.changed/);
  assert.match(event, /"threadId":"thread"/);
  await second.cancel();
});
