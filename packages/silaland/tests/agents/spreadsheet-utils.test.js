import { after, before, describe, it } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  XLSX_FALLBACK_IGNORE_NODES,
  getWorkbookSheetNames,
  getWorkbookWorksheets,
  loadWorkbookWithFallback,
  normalizeWorksheetName,
  resolveWorksheet,
} from "../../src/agent-runtime/tools/spreadsheet-utils.js";

describe("spreadsheetUtils", () => {
  let tempDir;
  let filePath;

  before(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sila-agents-spreadsheet-utils-"));
    filePath = path.join(tempDir, "test.xlsx");
    await fs.promises.writeFile(filePath, "placeholder");
  });

  after(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("filters worksheets and extracts names", () => {
    const workbook = {
      worksheets: [{ name: "Tasks" }, null, {}, { name: "" }, { name: "Summary" }],
    };

    const worksheets = getWorkbookWorksheets(workbook);
    const names = getWorkbookSheetNames(workbook);

    strictEqual(worksheets.length, 2);
    deepStrictEqual(names, ["Tasks", "Summary"]);
  });

  it("normalizes worksheet names", () => {
    strictEqual(normalizeWorksheetName("  Tasks  "), "Tasks");
    strictEqual(normalizeWorksheetName(""), "Sheet1");
    strictEqual(normalizeWorksheetName(undefined, "Main"), "Main");
  });

  it("resolves worksheet by default, index, and name", () => {
    const tasks = { name: "Tasks" };
    const summary = { name: "Summary" };
    const workbook = {
      worksheets: [tasks, summary],
      getWorksheet(ref) {
        if (ref === 1) return tasks;
        if (ref === 2) return summary;
        if (ref === "Tasks") return tasks;
        if (ref === "Summary") return summary;
        return null;
      },
    };

    strictEqual(resolveWorksheet(workbook), tasks);
    strictEqual(resolveWorksheet(workbook, 2), summary);
    strictEqual(resolveWorksheet(workbook, "Summary"), summary);
    strictEqual(resolveWorksheet(workbook, "Missing"), null);
  });

  it("loads xlsx with fallback when primary parser fails", async () => {
    const calls = [];
    const workbook = {
      xlsx: {
        async load(_, options) {
          calls.push(options || null);
          if (calls.length === 1) {
            throw new Error("primary failed");
          }
        },
      },
      csv: { async readFile() {} },
    };

    const result = await loadWorkbookWithFallback(workbook, filePath, ".xlsx");

    strictEqual(calls.length, 2);
    strictEqual(calls[0], null);
    deepStrictEqual(calls[1], { ignoreNodes: XLSX_FALLBACK_IGNORE_NODES });
    ok(result.warning.includes("primary failed"));
  });

  it("throws combined error when both xlsx parsers fail", async () => {
    const workbook = {
      xlsx: {
        async load(_, options) {
          if (options) {
            throw new Error("fallback failed");
          }
          throw new Error("primary failed");
        },
      },
      csv: { async readFile() {} },
    };

    await (async () => {
      try {
        await loadWorkbookWithFallback(workbook, filePath, ".xlsx");
      } catch (error) {
        ok(error.message.includes("primary=primary failed"));
        ok(error.message.includes("fallback=fallback failed"));
        return;
      }
      throw new Error("Expected loadWorkbookWithFallback to throw.");
    })();
  });
});
