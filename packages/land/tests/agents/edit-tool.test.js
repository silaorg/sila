import { after, before, describe, it } from "node:test";
import { ok, strictEqual } from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { createToolEditDocument } from "../../src/agent-runtime/tools/edit-tool.js";

describe("editTool", () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sila-agents-edit-"));
  });

  after(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes and appends content", async () => {
    const tool = createToolEditDocument({ baseDir: tempDir });

    const write = await tool.handler({
      path: "doc.txt",
      operation: "write",
      content: "Hello",
    });
    strictEqual(write.status, "completed");

    const append = await tool.handler({
      path: "doc.txt",
      operation: "append",
      content: "\nWorld",
    });
    strictEqual(append.status, "completed");

    const content = await fs.promises.readFile(path.join(tempDir, "doc.txt"), "utf8");
    strictEqual(content, "Hello\nWorld");
  });

  it("replaces exact text", async () => {
    const tool = createToolEditDocument({ baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "replace.txt"), "A\nB\nC", "utf8");

    const result = await tool.handler({
      path: "replace.txt",
      operation: "replace",
      search: "B",
      replace: "Bee",
    });

    strictEqual(result.status, "completed");
    const content = await fs.promises.readFile(path.join(tempDir, "replace.txt"), "utf8");
    strictEqual(content, "A\nBee\nC");
  });

  it("fails replace when search text is missing", async () => {
    const tool = createToolEditDocument({ baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "missing.txt"), "Alpha", "utf8");

    const result = await tool.handler({
      path: "missing.txt",
      operation: "replace",
      search: "Beta",
      replace: "Gamma",
    });

    strictEqual(result.status, "failed");
    ok(result.output.includes("Search text not found"));
  });

  it("writes, appends row, and updates cells in spreadsheets", async () => {
    const tool = createToolEditDocument({ baseDir: tempDir });
    const filePath = path.join(tempDir, "budget.xlsx");

    const write = await tool.handler({
      path: "budget.xlsx",
      type: "excel",
      operation: "write",
      content: JSON.stringify([
        ["Item", "Amount"],
        ["Hosting", 10],
      ]),
    });
    strictEqual(write.status, "completed");

    const append = await tool.handler({
      path: "budget.xlsx",
      type: "excel",
      operation: "append_row",
      content: JSON.stringify(["Storage", 5]),
    });
    strictEqual(append.status, "completed");

    const update = await tool.handler({
      path: "budget.xlsx",
      type: "excel",
      operation: "update_cell",
      cell: "B2",
      content: "15",
    });
    strictEqual(update.status, "completed");

    const formula = await tool.handler({
      path: "budget.xlsx",
      type: "excel",
      operation: "update_cell",
      cell: "B4",
      content: "=B2+B3",
    });
    strictEqual(formula.status, "completed");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];
    strictEqual(sheet.getCell("A2").value, "Hosting");
    strictEqual(sheet.getCell("B2").value, 15);
    strictEqual(sheet.getCell("A3").value, "Storage");
    strictEqual(sheet.getCell("B3").value, 5);
    strictEqual(sheet.getCell("B4").value.formula, "B2+B3");
  });

  it("writes, appends, and replaces content in Word documents", async () => {
    const tool = createToolEditDocument({ baseDir: tempDir });
    const wordPath = path.join(tempDir, "notes.docx");

    const write = await tool.handler({
      path: "notes.docx",
      type: "word",
      operation: "write",
      content: "Alpha",
    });
    strictEqual(write.status, "completed");

    const append = await tool.handler({
      path: "notes.docx",
      type: "word",
      operation: "append",
      content: "Beta",
    });
    strictEqual(append.status, "completed");

    const replace = await tool.handler({
      path: "notes.docx",
      type: "word",
      operation: "replace",
      search: "Beta",
      replace: "Gamma",
    });
    strictEqual(replace.status, "completed");

    const extracted = await mammoth.extractRawText({ buffer: await fs.promises.readFile(wordPath) });
    ok(extracted.value.includes("Alpha"));
    ok(extracted.value.includes("Gamma"));
  });
});
