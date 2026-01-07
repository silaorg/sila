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
});

