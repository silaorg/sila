import assert from 'node:assert/strict';
import test from 'node:test';
import { subscribeToChanges } from '../src/lib/workspace-events.ts';
const turn = () => new Promise((resolve) => setImmediate(resolve));

function fakeClient() {
  return {
    listener: null,
    receive: null,
    closed: false,
    onConnectionChange(callback) {
      this.listener = callback;
      return () => {
        this.listener = null;
      };
    },
    async connect() {
      this.listener(true);
    },
    async subscribe(route, callback) {
      this.route = route;
      this.receive = callback;
    },
    close() {
      this.closed = true;
    },
  };
}

test('subscribes before snapshot refresh and refreshes again after reconnect', async () => {
  const client = fakeClient();
  const changes = [];
  const stop = subscribeToChanges(
    client,
    'user-a',
    (change) => changes.push(change),
    assert.fail,
  );
  await turn();
  assert.equal(client.route, '/users/user-a/events');
  assert.deepEqual(changes, [{ type: 'connected' }]);
  client.receive({
    data: { type: 'thread.changed', workspaceId: 'w', threadId: 't' },
  });
  client.receive({ data: { type: 'thread.changed', threadId: 42 } });
  client.receive({ data: { type: 'unknown' } });
  client.listener(false);
  client.listener(true);
  assert.deepEqual(
    changes.map((c) => c.type),
    ['connected', 'thread.changed', 'connected'],
  );
  stop();
  client.receive({ data: { type: 'workspace.changed' } });
  assert.equal(changes.length, 3);
  assert.equal(client.closed, true);
  assert.equal(client.listener, null);
});

test('closing during connect prevents a late subscription', async () => {
  const client = fakeClient();
  let release;
  client.connect = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const stop = subscribeToChanges(client, 'user', assert.fail, assert.fail);
  stop();
  release();
  await turn();
  assert.equal(client.route, undefined);
});

test('subscription failures are reported', async () => {
  const client = fakeClient();
  client.subscribe = async () => {
    throw new Error('forbidden');
  };
  const errors = [];
  const stop = subscribeToChanges(client, 'user', assert.fail, (error) =>
    errors.push(error.message),
  );
  await turn();
  assert.deepEqual(errors, ['forbidden']);
  assert.equal(client.closed, true);
  assert.equal(client.listener, null);
  stop();
});
