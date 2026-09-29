import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { Client } from 'neorest';
import { AppEventBroker } from '../src/lib/server/app-events.ts';

/** @param {import("node:test").TestContext} t */
async function fixture(t, { websocket = true } = {}) {
  const broker = new AppEventBroker();
  const revoked = new Set();
  const origin = 'http://app.test';
  const handlers = await broker.start({
    origin,
    authenticate: ({ url }) => {
      // Stand-in for a cookie session; production resolves Better Auth headers.
      const user = url.searchParams.get('testUser');
      return user ? { id: user, sessionId: user } : null;
    },
    isSessionActive: (identity) => !revoked.has(identity.sessionId),
  });
  const server = createServer((req, res) => {
    void handlers.request(req, res).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end();
      }
    });
  });
  server.on('upgrade', (req, socket, head) => {
    if (!websocket) {
      socket.destroy();
      return;
    }
    void handlers.upgrade(req, socket, head);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}`;
  /** @type {Client[]} */
  const clients = [];
  t.after(async () => {
    for (const client of clients) client.close();
    await broker.close();
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve(undefined))),
    );
  });
  /** @param {string} user @param {import('neorest/core').TransportMode} [transport] */
  function client(user, transport = 'http') {
    const instance = new Client(url + '?testUser=' + user, transport, {
      headers: { 'x-test-user': 'b' },
      timeout: 2000,
      reconnect: false,
      transports: ['websocket'],
    });
    clients.push(instance);
    return instance;
  }
  return { broker, revoked, handlers, server, url, client };
}

/** @type {Array<'http' | 'websocket' | 'auto'>} */
const transports = ['http', 'websocket', 'auto'];
for (const transport of transports) {
  test(
    `Neorest ${transport} authenticates and isolates user subscriptions`,
    { timeout: 10000 },
    async (t) => {
      const { broker, url, client } = await fixture(t);
      assert.equal((await fetch(url + '/.neorest')).status, 401);
      assert.equal(
        (
          await fetch(url + '/.neorest', {
            headers: { Origin: 'https://attacker.test', 'x-test-user': 'a' },
          })
        ).status,
        403,
      );
      const a = client('a', transport),
        b = client('b', transport);
      await Promise.all([a.connect(), b.connect()]);
      await assert.rejects(
        a.subscribe('/users/b/events', () =>
          assert.fail('Unauthorized delivery'),
        ),
        /forbidden/i,
      );
      /** @type {unknown[]} */
      const receivedA = [];
      /** @type {unknown[]} */
      const receivedB = [];
      const { promise: delivery, resolve: delivered } = Promise.withResolvers();
      await a.subscribe('/users/a/events', (event) => {
        receivedA.push(event.data);
        delivered(undefined);
      });
      await b.subscribe('/users/b/events', (event) =>
        receivedB.push(event.data),
      );
      broker.publish({
        type: 'thread.changed',
        userId: 'a',
        workspaceId: 'w',
        threadId: 't',
      });
      await delivery;
      assert.deepEqual(receivedA, [
        { type: 'thread.changed', workspaceId: 'w', threadId: 't' },
      ]);
      assert.deepEqual(receivedB, []);
    },
  );
}

for (const transport of transports) {
  test(
    `revoked sessions cannot receive ${transport} broadcasts or subscribe again`,
    { timeout: 10000 },
    async (t) => {
      const { broker, revoked, client } = await fixture(t);
      const a = client('a', transport);
      await a.connect();
      /** @type {unknown[]} */
      const received = [];
      await a.subscribe('/users/a/events', (event) =>
        received.push(event.data),
      );
      revoked.add('a');
      broker.publish({ type: 'workspace.changed', userId: 'a' });
      const another = client('a', transport);
      await another.connect();
      await assert.rejects(
        another.subscribe('/users/a/events', () => {}),
        /forbidden/i,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.deepEqual(received, []);
    },
  );
}

test(
  'auto falls back to held HTTP when WebSocket upgrade is unavailable',
  { timeout: 10000 },
  async (t) => {
    const { broker, client } = await fixture(t, { websocket: false });
    const a = client('a', 'auto');
    await a.connect();
    const { promise: delivery, resolve: delivered } = Promise.withResolvers();
    await a.subscribe('/users/a/events', (event) => delivered(event.data));
    broker.publish({
      type: 'workspace.files.changed',
      userId: 'a',
      workspaceId: 'w',
    });
    assert.deepEqual(await delivery, {
      type: 'workspace.files.changed',
      workspaceId: 'w',
    });
  },
);
