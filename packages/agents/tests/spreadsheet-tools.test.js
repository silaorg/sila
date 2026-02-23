import { after, before, describe, it } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { createToolEditDocument } from "../src/tools/edit-tool.js";
import { createToolReadDocument } from "../src/tools/read-tool.js";

async function withForcedPrimaryXlsxLoadFailure(run) {
  const xlsxProto = Object.getPrototypeOf(new ExcelJS.Workbook().xlsx);
  const originalLoad = xlsxProto.load;

  xlsxProto.load = async function patchedLoad(data, options) {
    if (!options) {
      throw new Error("forced primary parse failure");
    }
    return originalLoad.call(this, data, options);
  };

  try {
    await run();
  } finally {
    xlsxProto.load = originalLoad;
  }
}

describe("spreadsheetTools", () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sila-agents-spreadsheet-tools-"));
  });

  after(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("lists and reads specific worksheets", async () => {
    const workbook = new ExcelJS.Workbook();
    const tasks = workbook.addWorksheet("Tasks");
    tasks.addRow(["Task", "Status"]);
    tasks.addRow(["Write tests", "Done"]);
    const summary = workbook.addWorksheet("Summary");
    summary.addRow(["Metric", "Value"]);
    summary.addRow(["Total", 1]);
    await workbook.xlsx.writeFile(path.join(tempDir, "multi-sheet.xlsx"));

    const read = createToolReadDocument({ baseDir: tempDir });
    const list = await read.handler({ path: "multi-sheet.xlsx", listSheets: true });

    strictEqual(list.type, "excel");
    deepStrictEqual(list.sheets, ["Tasks", "Summary"]);
    strictEqual(list.defaultSheet, "Tasks");

    const summaryRead = await read.handler({
      path: "multi-sheet.xlsx",
      sheet: "Summary",
      asObjects: true,
      headerRow: "1",
    });
    strictEqual(summaryRead.type, "excel");
    strictEqual(summaryRead.sheet, "Summary");
    strictEqual(summaryRead.data[0].Metric, "Total");
    strictEqual(summaryRead.data[0].Value, 1);
  });

  it("auto-detects headers and handles result/compute value modes", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");
    sheet.addRow(["Notes only row"]);
    sheet.addRow(["Item", "A", "B", "Total"]);
    sheet.addRow(["One", 2, 3, { formula: "B3+C3", result: 5 }]);
    sheet.addRow([]);
    sheet.addRow(["Two", 7, 4, { formula: "B5+C5", result: 11 }]);
    await workbook.xlsx.writeFile(path.join(tempDir, "value-modes.xlsx"));

    const read = createToolReadDocument({ baseDir: tempDir });

    const raw = await read.handler({
      path: "value-modes.xlsx",
      sheet: "Report",
      asObjects: true,
      headerRow: "auto",
      valueMode: "raw",
      fillMissingCells: true,
      skipEmptyRows: true,
    });
    strictEqual(raw.headerRow, 2);
    strictEqual(raw.data[0].Total, "=B3+C3");
    strictEqual(raw.data[1].Total, "=B5+C5");

    const resultMode = await read.handler({
      path: "value-modes.xlsx",
      sheet: "Report",
      asObjects: true,
      headerRow: "2",
      valueMode: "result",
      skipEmptyRows: true,
    });
    strictEqual(resultMode.data[0].Total, 5);
    strictEqual(resultMode.data[1].Total, 11);

    const computeMode = await read.handler({
      path: "value-modes.xlsx",
      sheet: "Report",
      asObjects: true,
      headerRow: "2",
      valueMode: "compute",
      skipEmptyRows: true,
    });
    strictEqual(computeMode.data[0].Total, 5);
    strictEqual(computeMode.data[1].Total, 11);
  });

  it("blocks lossy edits when fallback parser is used unless explicitly allowed", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Tasks");
    sheet.addRow(["Task", "Status"]);
    sheet.addRow(["Review", "Done"]);
    const filePath = path.join(tempDir, "fallback-edit.xlsx");
    await workbook.xlsx.writeFile(filePath);

    const read = createToolReadDocument({ baseDir: tempDir });
    const edit = createToolEditDocument({ baseDir: tempDir });

    await withForcedPrimaryXlsxLoadFailure(async () => {
      const list = await read.handler({ path: "fallback-edit.xlsx", listSheets: true });
      ok(Array.isArray(list.warnings));
      ok(list.warnings[0].includes("forced primary parse failure"));

      const blocked = await edit.handler({
        path: "fallback-edit.xlsx",
        type: "excel",
        operation: "update_cell",
        sheet: "Tasks",
        cell: "B2",
        content: "Todo",
      });
      strictEqual(blocked.status, "failed");
      ok(blocked.output.includes("Editing aborted to prevent lossy save"));
      ok(Array.isArray(blocked.warnings));

      const allowed = await edit.handler({
        path: "fallback-edit.xlsx",
        type: "excel",
        operation: "update_cell",
        sheet: "Tasks",
        cell: "B2",
        content: "Todo",
        allowLossySpreadsheetFallback: true,
      });
      strictEqual(allowed.status, "completed");
      ok(Array.isArray(allowed.warnings));
    });

    const verify = createToolReadDocument({ baseDir: tempDir });
    const result = await verify.handler({
      path: "fallback-edit.xlsx",
      sheet: "Tasks",
      asObjects: true,
      headerRow: "1",
    });
    strictEqual(result.data[0].Status, "Todo");
  });
});
