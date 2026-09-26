import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  downloadRemoteFile,
  fetchRemote,
  readResponseBytes,
  readResponseText,
} from "../src/http.js";

let server;
let baseUrl;

before(async () => {
  server = http.createServer((request, response) => {
    if (request.url === "/slow") {
      setTimeout(() => response.end("late"), 100);
      return;
    }
    if (request.url === "/declared-large") {
      response.setHeader("content-length", "100");
      response.end("small");
      return;
    }
    if (request.url === "/streamed-large") {
      response.write("12345");
      response.end("67890");
      return;
    }
    if (request.url === "/download") {
      response.end("downloaded");
      return;
    }
    response.end("hello");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("fetchRemote aborts slow requests", async () => {
  await assert.rejects(
    fetchRemote(`${baseUrl}/slow`, {}, { timeoutMs: 10 }),
    /timed out after 10ms/,
  );
});

test("readResponseBytes rejects declared and streamed oversized responses", async () => {
  const declared = await fetchRemote(`${baseUrl}/declared-large`);
  await assert.rejects(readResponseBytes(declared, { maxBytes: 9 }), /9-byte limit/);

  const streamed = await fetchRemote(`${baseUrl}/streamed-large`);
  await assert.rejects(readResponseBytes(streamed, { maxBytes: 9 }), /9-byte limit/);
});

test("readResponseText returns bounded text", async () => {
  const response = await fetchRemote(baseUrl);
  assert.equal(await readResponseText(response, { maxBytes: 10 }), "hello");
});

test("downloadRemoteFile writes bounded downloads and removes partial files", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "heswe-download-"));
  const downloadedPath = path.join(directory, "downloaded.txt");
  const rejectedPath = path.join(directory, "rejected.txt");

  const result = await downloadRemoteFile(`${baseUrl}/download`, downloadedPath, {
    maxBytes: 20,
  });
  assert.equal(result.byteLength, 10);
  assert.equal(await fs.readFile(downloadedPath, "utf8"), "downloaded");

  await assert.rejects(
    downloadRemoteFile(`${baseUrl}/streamed-large`, rejectedPath, { maxBytes: 9 }),
    /9-byte limit/,
  );
  await assert.rejects(fs.access(rejectedPath), { code: "ENOENT" });
});
