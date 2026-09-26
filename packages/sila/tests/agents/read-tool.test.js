import { after, before, describe, it } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph } from "docx";
import { createToolReadDocument } from "../../src/agent-runtime/tools/read-tool.js";

async function writeDocx(filePath, lines) {
  const document = new Document({
    sections: [
      {
        properties: {},
        children: lines.map((line) => new Paragraph(line)),
      },
    ],
  });
  const buffer = await Packer.toBuffer(document);
  await fs.promises.writeFile(filePath, buffer);
}

describe("readTool", () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sila-agents-read-"));
  });

  after(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reads a local text file", async () => {
    const tool = createToolReadDocument({ baseDir: tempDir });
    await fs.promises.writeFile(path.join(tempDir, "sample.txt"), "Hello World\nLine 2", "utf8");

    const result = await tool.handler({ path: "sample.txt" });
    strictEqual(result.type, "text");
    strictEqual(result.totalLines, 2);
    strictEqual(result.content, "Hello World\nLine 2");
  });

  it("reads a specific range of lines", async () => {
    const tool = createToolReadDocument({ baseDir: tempDir });
    const content = Array.from({ length: 10 }, (_, index) => `Line ${index + 1}`).join("\n");
    await fs.promises.writeFile(path.join(tempDir, "range.txt"), content, "utf8");

    const result = await tool.handler({ path: "range.txt", start: 2, limit: 3 });
    strictEqual(result.content, "Line 3\nLine 4\nLine 5");
  });

  it("returns error for missing file", async () => {
    const tool = createToolReadDocument({ baseDir: tempDir });
    const result = await tool.handler({ path: "missing.txt" });
    ok(result.error);
    ok(result.error.includes("File not found"));
  });

  it("reads and strips basic HTML from a URL", async () => {
    const tool = createToolReadDocument({ baseDir: tempDir });

    const server = http.createServer((_, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<html><body><h1>Hello</h1><p>world</p></body></html>");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const result = await tool.handler({ path: `http://127.0.0.1:${port}/` });

    await new Promise((resolve) => server.close(resolve));

    strictEqual(result.type, "url");
    ok(result.content.includes("Hello world"));
  });

  it("reads spreadsheet rows and computes formulas", async () => {
    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet("Summary");
    summary.addRow(["Item", "A", "B", "Total"]);
    summary.addRow(["One", 2, 3, { formula: "B2+C2" }]);
    summary.addRow(["Two", 7, 5, { formula: "B3+C3" }]);
    workbook.addWorksheet("Raw");
    await workbook.xlsx.writeFile(path.join(tempDir, "metrics.xlsx"));

    const tool = createToolReadDocument({ baseDir: tempDir });
    const list = await tool.handler({ path: "metrics.xlsx", listSheets: true });
    strictEqual(list.type, "excel");
    deepStrictEqual(list.sheets, ["Summary", "Raw"]);

    const result = await tool.handler({
      path: "metrics.xlsx",
      sheet: "Summary",
      asObjects: true,
      headerRow: "1",
      valueMode: "compute",
    });

    strictEqual(result.type, "excel");
    strictEqual(result.sheet, "Summary");
    strictEqual(result.data[0].Total, 5);
    strictEqual(result.data[1].Total, 12);
  });

  it("reads Word documents", async () => {
    await writeDocx(path.join(tempDir, "notes.docx"), ["Alpha", "Beta", "Gamma"]);

    const tool = createToolReadDocument({ baseDir: tempDir });
    const result = await tool.handler({ path: "notes.docx", start: 0, limit: 20 });

    strictEqual(result.type, "word");
    ok(result.content.includes("Alpha"));
    ok(result.content.includes("Beta"));
    ok(result.content.includes("Gamma"));
  });
});
