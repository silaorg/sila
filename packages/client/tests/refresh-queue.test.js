import assert from 'node:assert/strict';
import test from 'node:test';
import { RefreshQueue } from '../src/lib/refresh-queue.ts';
const turn = () => new Promise((resolve) => setImmediate(resolve));

test('coalesces overlapping invalidations without losing the final refresh', async () => {
 const queue = new RefreshQueue((error) => { throw error; });
 let calls = 0;
 let release;
 const blocked = new Promise((resolve) => { release = resolve; });
 const task = async () => { calls++; if (calls === 1) await blocked; };
 queue.request('thread', task);
 queue.request('thread', task);
 await turn();
 assert.equal(calls, 1);
 for (let i = 0; i < 10; i++) queue.request('thread', task);
 await turn();
 assert.equal(calls, 1);
 release();
 await turn();
 assert.equal(calls, 2);
});

test('resources refresh independently, failures recover, and stop drops queued work', async () => {
 const errors = [];
 const queue = new RefreshQueue((error) => errors.push(error));
 let release;
 const blocked = new Promise((resolve) => { release = resolve; });
 let calls = 0;
 queue.request('a', async () => { await blocked; throw new Error('offline'); });
 queue.request('b', async () => { calls++; });
 await turn();
 assert.equal(calls, 1);
 release();
 await turn();
 assert.equal(errors.length, 1);
 queue.request('a', async () => { calls++; });
 await turn();
 assert.equal(calls, 2);
 queue.request('c', async () => { calls++; });
 queue.stop();
 await turn();
 assert.equal(calls, 2);
});
