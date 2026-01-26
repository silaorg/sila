import { describe, it, expect } from "vitest";
import { toolSpreadsheet } from "../../../../src/agents/tools/toolSpreadsheet";
import { RepTree } from "reptree";
import type { AppTree } from "../../../../src/spaces/AppTree";
import type { Space } from "../../../../src/spaces/Space";
import type { FileStore } from "../../../../src/spaces/files/FileStore";

// Mock FileStore
class MockFileStore {
    data = new Map<string, Uint8Array>();

    async putMutable(id: string, data: Uint8Array) {
        this.data.set(id, data);
        return { hash: id, size: data.byteLength };
    }

    async get(id: string) {
        return this.data.get(id);
    }
}

describe("toolSpreadsheet", () => {
    it("should create, append, and read a spreadsheet", async () => {
        // Setup
        const store = new MockFileStore();
        const tree = new RepTree("test-tree");
        tree.createRoot();
        const root = tree.root!;
        root.newNamedChild("files");

        const appTree = {
            tree,
            getId: () => "test-tree-id"
        } as unknown as AppTree;

        const space = {
            fileStore: store as unknown as FileStore,
            rootVertex: root,
        } as unknown as Space;

        const tool = toolSpreadsheet.getTool({ space } as any, appTree);

        // 1. Create
        const createRes = await tool.handler({ action: "create", path: "file:///files/test.xlsx" });
        expect(createRes.status).toBe("completed");

        // 2. Append (Header)
        const appendRes1 = await tool.handler({
            action: "append",
            path: "file:///files/test.xlsx",
            data: JSON.stringify([["Name", "Age"]])
        });
        expect(appendRes1.status).toBe("completed");

        // 3. Append (Data)
        const appendRes2 = await tool.handler({
            action: "append",
            path: "file:///files/test.xlsx",
            data: JSON.stringify([["Alice", 30], ["Bob", 25]])
        });
        expect(appendRes2.status).toBe("completed");

        // 4. Read
        const readRes = await tool.handler({ action: "read", path: "file:///files/test.xlsx" });
        expect(readRes.status).toBe("completed");
        expect(readRes.output).toContain("Name,Age");
        expect(readRes.output).toContain("Alice,30");

        // 5. Update Cell
        const updateRes = await tool.handler({
            action: "update_cell",
            path: "file:///files/test.xlsx",
            cell: "B2",
            data: 31
        });
        expect(updateRes.status).toBe("completed");

        // 6. Read again
        const readRes2 = await tool.handler({ action: "read", path: "file:///files/test.xlsx" });
        expect(readRes2.output).toContain("Alice,31");
    });
});
