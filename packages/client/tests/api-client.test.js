import assert from 'node:assert/strict';
import test from 'node:test';
import { subscribeToWorkspaceChanges } from '../src/lib/api-client.ts';

test('handles connection snapshots, validates invalidations, and closes the stream', (t) => {
 let stream;
 class FakeEventSource extends EventTarget {
  constructor() { super(); stream = this; }
  close() { this.closed = true; }
  emit(type, data) { this.dispatchEvent(new MessageEvent(type, {data: JSON.stringify(data)})); }
 }
 const original = Object.getOwnPropertyDescriptor(globalThis, 'EventSource');
 Object.defineProperty(globalThis, 'EventSource', {value:FakeEventSource, configurable:true});
 t.after(() => { if (original) Object.defineProperty(globalThis, 'EventSource', original); else delete globalThis.EventSource; });
 const changes = [];
 const stop = subscribeToWorkspaceChanges((change) => changes.push(change));
 stream.emit('connected', {type:'connected'});
 stream.emit('connected', {type:'connected'});
 stream.emit('thread.changed', {type:'thread.changed',workspaceId:'w',threadId:'t'});
 stream.emit('thread.changed', {type:'thread.changed',threadId:123});
 stream.emit('thread.changed', {type:'unknown'});
 assert.deepEqual(changes.map(c=>c.type), ['connected','connected','thread.changed']);
 stop();
 assert.equal(stream.closed, true);
});
