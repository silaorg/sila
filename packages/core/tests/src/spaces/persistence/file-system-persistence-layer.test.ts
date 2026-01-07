import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FileSystemPersistenceLayer,
  newSetVertexPropertyOp,
} from "@sila/core";
import { NodeFileSystem } from "../../setup/setup-node-file-system";

class RecordingFileSystem extends NodeFileSystem {
  writeTextFileCalls = 0;
  writeTextFilePaths: string[] = [];

  override async writeTextFile(filePath: string, content: string): Promise<void> {
    this.writeTextFileCalls++;
    this.writeTextFilePaths.push(filePath);
    return await super.writeTextFile(filePath, content);
  }
}

function propOpsFilePath(root: string, treeId: string, peerId: string, date = new Date()): string {
  const prefix = treeId.substring(0, 2);
  const suffix = treeId.substring(2);
  const year = date.getUTCFullYear().toString();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${root}/space-v1/ops/${prefix}/${suffix}/${year}/${month}/${day}/${peerId}-p.jsonl`;
}

describe("FileSystemPersistenceLayer - property ops compaction", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "sila-fspl-"));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("does not rewrite prop ops file when there are no duplicates and ops are sorted", async () => {
    const fs = new RecordingFileSystem();
    const treeId = crypto.randomUUID();
    const peerId = "peer-a";

    const layer = new FileSystemPersistenceLayer(tempDir, treeId, fs);
    await layer.connect();

    const targetId = "node-1";
    const ops = Array.from({ length: 10 }, (_, i) =>
      newSetVertexPropertyOp(i + 1, peerId, targetId, `k${i + 1}`, `v${i + 1}`)
    );

    await layer.saveTreeOps(treeId, ops);
    await layer.disconnect(); // flush + attempt compaction

    // writeTextFile is only used by compaction rewrite path
    expect(fs.writeTextFileCalls).toBe(0);

    const filePath = propOpsFilePath(tempDir, treeId, peerId);
    expect(await fs.exists(filePath)).toBe(true);
    const lines = await fs.readTextFileLines(filePath);
    expect(lines.length).toBe(10);
  });

  it("compacts duplicates (same targetId+key) down to the latest op after 10 prop ops", async () => {
    const fs = new RecordingFileSystem();
    const treeId = crypto.randomUUID();
    const peerId = "peer-b";

    const layer = new FileSystemPersistenceLayer(tempDir, treeId, fs);
    await layer.connect();

    const targetId = "node-1";
    const key = "title";
    const ops = Array.from({ length: 10 }, (_, i) =>
      newSetVertexPropertyOp(i + 1, peerId, targetId, key, `v${i + 1}`)
    );

    await layer.saveTreeOps(treeId, ops);
    await layer.disconnect(); // flush + compaction should rewrite

    expect(fs.writeTextFileCalls).toBe(1);

    const filePath = propOpsFilePath(tempDir, treeId, peerId);
    const lines = await fs.readTextFileLines(filePath);
    expect(lines.length).toBe(1);

    const parsed = JSON.parse(lines[0]) as [number, string, string, string];
    expect(parsed[0]).toBe(10);
    expect(parsed[1]).toBe(targetId);
    expect(parsed[2]).toBe(key);
    expect(parsed[3]).toBe("v10");
  });

  it("keeps the latest op per (targetId,key) and outputs ops sorted by counter", async () => {
    const fs = new RecordingFileSystem();
    const treeId = crypto.randomUUID();
    const peerId = "peer-c";

    const layer = new FileSystemPersistenceLayer(tempDir, treeId, fs);
    await layer.connect();

    const ops = [
      // target A
      newSetVertexPropertyOp(1, peerId, "A", "title", "A-title-1"),
      newSetVertexPropertyOp(2, peerId, "A", "desc", "A-desc-2"),
      newSetVertexPropertyOp(3, peerId, "A", "title", "A-title-3"), // latest for (A,title)

      // target B
      newSetVertexPropertyOp(4, peerId, "B", "title", "B-title-4"), // latest for (B,title)
      newSetVertexPropertyOp(5, peerId, "B", "desc", "B-desc-5"),
      newSetVertexPropertyOp(6, peerId, "B", "desc", "B-desc-6"), // latest for (B,desc)

      // filler unique keys to hit 10 ops threshold
      newSetVertexPropertyOp(7, peerId, "C", "k1", "v7"),
      newSetVertexPropertyOp(8, peerId, "C", "k2", "v8"),
      newSetVertexPropertyOp(9, peerId, "C", "k3", "v9"),
      newSetVertexPropertyOp(10, peerId, "C", "k4", "v10"),
    ];

    await layer.saveTreeOps(treeId, ops);
    await layer.disconnect();

    // Duplicates exist (A/title and B/desc), so we should rewrite once.
    expect(fs.writeTextFileCalls).toBe(1);

    const filePath = propOpsFilePath(tempDir, treeId, peerId);
    const lines = await fs.readTextFileLines(filePath);

    // Expected unique keys:
    // A:title, A:desc, B:title, B:desc, C:k1..k4 => 8 ops total
    expect(lines.length).toBe(8);

    const parsed = lines.map((l) => JSON.parse(l) as [number, string, string, any]);
    const counters = parsed.map((p) => p[0]);

    // Output must be sorted by counter
    for (let i = 1; i < counters.length; i++) {
      expect(counters[i]).toBeGreaterThanOrEqual(counters[i - 1]);
    }

    // And the latest values must be present
    const byKey = new Map<string, [number, string, string, any]>();
    for (const p of parsed) {
      byKey.set(`${p[1]}:${p[2]}`, p);
    }

    expect(byKey.get("A:title")![0]).toBe(3);
    expect(byKey.get("A:title")![3]).toBe("A-title-3");
    expect(byKey.get("B:desc")![0]).toBe(6);
    expect(byKey.get("B:desc")![3]).toBe("B-desc-6");
  });

  it("rewrites when ops are unsorted (even with no duplicate keys) and sorts them", async () => {
    const fs = new RecordingFileSystem();
    const treeId = crypto.randomUUID();
    const peerId = "peer-d";

    const layer = new FileSystemPersistenceLayer(tempDir, treeId, fs);
    await layer.connect();

    // Intentionally unsorted counters (unique keys so compaction should only sort).
    const ops = [
      newSetVertexPropertyOp(10, peerId, "node-1", "k10", "v10"),
      newSetVertexPropertyOp(9, peerId, "node-1", "k9", "v9"),
      newSetVertexPropertyOp(8, peerId, "node-1", "k8", "v8"),
      newSetVertexPropertyOp(7, peerId, "node-1", "k7", "v7"),
      newSetVertexPropertyOp(6, peerId, "node-1", "k6", "v6"),
      newSetVertexPropertyOp(5, peerId, "node-1", "k5", "v5"),
      newSetVertexPropertyOp(4, peerId, "node-1", "k4", "v4"),
      newSetVertexPropertyOp(3, peerId, "node-1", "k3", "v3"),
      newSetVertexPropertyOp(2, peerId, "node-1", "k2", "v2"),
      newSetVertexPropertyOp(1, peerId, "node-1", "k1", "v1"),
    ];

    await layer.saveTreeOps(treeId, ops);
    await layer.disconnect();

    // Unsorted => rewrite once
    expect(fs.writeTextFileCalls).toBe(1);

    const filePath = propOpsFilePath(tempDir, treeId, peerId);
    const lines = await fs.readTextFileLines(filePath);
    expect(lines.length).toBe(10);

    const parsed = lines.map((l) => JSON.parse(l) as [number, string, string, any]);
    const counters = parsed.map((p) => p[0]);
    for (let i = 1; i < counters.length; i++) {
      expect(counters[i]).toBeGreaterThanOrEqual(counters[i - 1]);
    }
    expect(counters[0]).toBe(1);
    expect(counters[counters.length - 1]).toBe(10);
  });
});

