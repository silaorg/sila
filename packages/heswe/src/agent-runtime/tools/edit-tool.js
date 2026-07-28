import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { ensureFileParent, normalizePath } from "./file-utils.js";
import {
  getWorkbookWorksheets,
  loadWorkbookWithFallback,
  normalizeWorksheetName,
} from "./spreadsheet-utils.js";

function parseSpreadsheetPayload(content) {
  if (Array.isArray(content)) {
    return content;
  }
  if (typeof content !== "string") {
    throw new Error("Spreadsheet content must be a JSON string or array.");
  }
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error("Spreadsheet content must be an array.");
  }
  return parsed;
}

function parseCellValue(content) {
  if (typeof content !== "string") {
    return content;
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.startsWith("=")) {
    return { formula: trimmed.slice(1) };
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
  return content;
}

function splitParagraphs(text) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  if (lines.length === 0) {
    return [new Paragraph({ children: [new TextRun("")] })];
  }
  return lines.map((line) => new Paragraph({ children: [new TextRun(line)] }));
}

async function writeWordDocx(fullPath, text) {
  const document = new Document({
    sections: [{ properties: {}, children: splitParagraphs(text) }],
  });
  const buffer = await Packer.toBuffer(document);
  await fs.promises.writeFile(fullPath, buffer);
}

function normalizeEditType(type, fullPath, operation) {
  if (typeof type === "string" && type.length > 0) {
    return type;
  }

  if (operation === "update_cell" || operation === "append_row") {
    return "excel";
  }

  const extension = path.extname(fullPath).toLowerCase();
  if (extension === ".xlsx" || extension === ".xls" || extension === ".csv") {
    return "excel";
  }
  if (extension === ".docx" || extension === ".doc") {
    return "word";
  }
  return "text";
}

async function handleTextEdit(fullPath, inputPath, operation, content, search, replace) {
  if (operation === "write") {
    await fs.promises.writeFile(fullPath, String(content), "utf8");
    return { status: "completed", output: `Wrote ${inputPath}` };
  }

  if (operation === "append") {
    await fs.promises.appendFile(fullPath, String(content), "utf8");
    return { status: "completed", output: `Appended to ${inputPath}` };
  }

  if (operation === "replace") {
    if (typeof search !== "string" || search.length === 0) {
      return { status: "failed", output: "operation=replace requires non-empty search text." };
    }

    const existing = fs.existsSync(fullPath) ? await fs.promises.readFile(fullPath, "utf8") : "";
    const index = existing.indexOf(search);
    if (index === -1) {
      return { status: "failed", output: `Search text not found in ${inputPath}` };
    }

    const updated = `${existing.slice(0, index)}${replace}${existing.slice(index + search.length)}`;
    await fs.promises.writeFile(fullPath, updated, "utf8");
    return { status: "completed", output: `Replaced text in ${inputPath}` };
  }

  return { status: "failed", output: `Unsupported text operation: ${operation}` };
}

async function resolveWorkbook(fullPath, operation) {
  const workbook = new ExcelJS.Workbook();
  const extension = path.extname(fullPath).toLowerCase();
  const fileExists = fs.existsSync(fullPath);

  if (!fileExists) {
    return { workbook, extension };
  }

  if (extension === ".xlsx") {
    const loadResult = await loadWorkbookWithFallback(workbook, fullPath, extension);
    return { workbook, extension, warning: loadResult.warning };
  }

  if (extension === ".csv") {
    await workbook.csv.readFile(fullPath);
    return { workbook, extension };
  }

  if (extension === ".xls") {
    throw new Error("Unsupported format .xls. Please export as .xlsx.");
  }

  if (operation !== "write") {
    throw new Error(`Unsupported spreadsheet file extension: ${extension || "(none)"}`);
  }

  return { workbook, extension };
}
function ensureWorksheet(workbook, sheetName) {
  const normalizedName = typeof sheetName === "string" ? sheetName.trim() : "";
  if (normalizedName.length > 0) {
    const existing = workbook.getWorksheet(normalizedName);
    if (existing) return existing;
    return workbook.addWorksheet(normalizedName);
  }

  const worksheets = getWorkbookWorksheets(workbook);
  if (worksheets[0]) {
    return worksheets[0];
  }
  return workbook.addWorksheet("Sheet1");
}

function replaceWorksheet(workbook, worksheet, sheetName) {
  const name = normalizeWorksheetName(sheetName, worksheet?.name || "Sheet1");
  const current = workbook.getWorksheet(name);
  if (current) {
    workbook.removeWorksheet(current.id);
  } else if (worksheet) {
    workbook.removeWorksheet(worksheet.id);
  }
  return workbook.addWorksheet(name);
}

async function saveWorkbook(workbook, fullPath, extension) {
  if (extension === ".csv") {
    const worksheet = getWorkbookWorksheets(workbook)[0] || workbook.addWorksheet("Sheet1");
    await workbook.csv.writeFile(fullPath, { sheetName: worksheet.name });
    return;
  }
  await workbook.xlsx.writeFile(fullPath);
}

function withWarning(result, warning) {
  if (!warning) return result;
  return { ...result, warnings: [warning] };
}

function lossyFallbackBlockedResult(warning) {
  return {
    status: "failed",
    output:
      "Editing aborted to prevent lossy save: this .xlsx required fallback parsing and may lose Excel table metadata. Use a plain .xlsx/.csv or set allowLossySpreadsheetFallback=true.",
    warnings: warning ? [warning] : undefined,
  };
}

async function handleExcelEdit(
  fullPath,
  inputPath,
  operation,
  content,
  cell,
  sheet,
  allowLossySpreadsheetFallback,
) {
  const extension = path.extname(fullPath).toLowerCase();
  if (extension === ".xls") {
    return { status: "failed", output: "Unsupported format .xls. Please export as .xlsx." };
  }
  if (extension && extension !== ".xlsx" && extension !== ".csv") {
    return { status: "failed", output: "Spreadsheet editing supports .xlsx and .csv files." };
  }

  const { workbook, extension: detectedExtension, warning } = await resolveWorkbook(fullPath, operation);
  if (warning && detectedExtension === ".xlsx" && !allowLossySpreadsheetFallback) {
    return lossyFallbackBlockedResult(warning);
  }
  let worksheet = ensureWorksheet(workbook, sheet);

  if (operation === "write") {
    const rows = parseSpreadsheetPayload(content);
    worksheet = replaceWorksheet(workbook, worksheet, sheet);
    worksheet.addRows(rows);
    await saveWorkbook(workbook, fullPath, detectedExtension);
    return withWarning({ status: "completed", output: `Wrote spreadsheet ${inputPath}` }, warning);
  }

  if (operation === "append_row") {
    const rowData = parseSpreadsheetPayload(content);
    worksheet.addRow(rowData);
    await saveWorkbook(workbook, fullPath, detectedExtension);
    return withWarning({ status: "completed", output: `Appended row to ${inputPath}` }, warning);
  }

  if (operation === "update_cell") {
    if (typeof cell !== "string" || cell.trim().length === 0) {
      return { status: "failed", output: "operation=update_cell requires a cell address (example: A1)." };
    }
    worksheet.getCell(cell).value = parseCellValue(content);
    await saveWorkbook(workbook, fullPath, detectedExtension);
    return withWarning(
      { status: "completed", output: `Updated cell ${cell} in ${inputPath}` },
      warning,
    );
  }

  return { status: "failed", output: `Unsupported spreadsheet operation: ${operation}` };
}

async function handleWordEdit(fullPath, inputPath, operation, content, search, replace) {
  const extension = path.extname(fullPath).toLowerCase();
  if (extension && extension !== ".docx" && extension !== ".doc") {
    return { status: "failed", output: "Word editing supports .docx files." };
  }
  if (extension === ".doc") {
    return {
      status: "failed",
      output: "Writing .doc is not supported. Use .docx for Word editing.",
    };
  }

  if (operation === "write") {
    await writeWordDocx(fullPath, content || "");
    return { status: "completed", output: `Wrote Word document ${inputPath}` };
  }

  const existingText = fs.existsSync(fullPath)
    ? (await mammoth.extractRawText({ buffer: await fs.promises.readFile(fullPath) })).value
    : "";

  if (operation === "append") {
    const prefix = existingText.trimEnd();
    const suffix = String(content ?? "");
    const merged = prefix.length > 0 && suffix.length > 0 ? `${prefix}\n${suffix}` : `${prefix}${suffix}`;
    await writeWordDocx(fullPath, merged);
    return { status: "completed", output: `Appended to Word document ${inputPath}` };
  }

  if (operation === "replace") {
    if (typeof search !== "string" || search.length === 0) {
      return { status: "failed", output: "operation=replace requires non-empty search text." };
    }
    const index = existingText.indexOf(search);
    if (index === -1) {
      return { status: "failed", output: `Search text not found in ${inputPath}` };
    }
    const updated = `${existingText.slice(0, index)}${replace}${existingText.slice(index + search.length)}`;
    await writeWordDocx(fullPath, updated);
    return { status: "completed", output: `Replaced text in Word document ${inputPath}` };
  }

  return { status: "failed", output: `Unsupported Word operation: ${operation}` };
}

export function createToolEditDocument(options = {}) {
  const { baseDir = process.cwd() } = options;

  return {
    name: "edit_document",
    description: "Create or edit text, spreadsheet, or Word documents.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file.",
        },
        type: {
          type: "string",
          enum: ["text", "excel", "word"],
          description: "Optional file type. If omitted, inferred from path and operation.",
        },
        operation: {
          type: "string",
          enum: ["write", "append", "replace", "update_cell", "append_row"],
          description:
            "Text: write/append/replace. Excel: write/update_cell/append_row. Word: write/append/replace.",
        },
        content: {
          type: "string",
          description:
            "Text content for text/word, or JSON array payload for spreadsheet write/append_row.",
        },
        search: {
          type: "string",
          description: "Exact text to search for when operation=replace.",
        },
        replace: {
          type: "string",
          description: "Replacement text when operation=replace.",
        },
        cell: {
          type: "string",
          description: "Spreadsheet cell address when operation=update_cell (example: A1).",
        },
        sheet: {
          type: "string",
          description: "Spreadsheet worksheet name. Defaults to first worksheet.",
        },
        allowLossySpreadsheetFallback: {
          type: "boolean",
          description:
            "If true, allows editing an .xlsx loaded via fallback parser (may remove Excel table metadata on save).",
          default: false,
        },
      },
      required: ["path", "operation"],
    },
    handler: async ({
      path,
      type,
      operation,
      content = "",
      search,
      replace = "",
      cell,
      sheet,
      allowLossySpreadsheetFallback = false,
    }) => {
      try {
        const fullPath = normalizePath(path, baseDir);
        await ensureFileParent(fullPath);

        const resolvedType = normalizeEditType(type, fullPath, operation);
        if (resolvedType === "text") {
          return await handleTextEdit(fullPath, path, operation, content, search, replace);
        }
        if (resolvedType === "excel") {
          return await handleExcelEdit(
            fullPath,
            path,
            operation,
            content,
            cell,
            sheet,
            Boolean(allowLossySpreadsheetFallback),
          );
        }
        if (resolvedType === "word") {
          return await handleWordEdit(fullPath, path, operation, content, search, replace);
        }

        return { status: "failed", output: `Unsupported type: ${resolvedType}` };
      } catch (error) {
        return { status: "failed", output: `Error editing file: ${error.message}` };
      }
    },
  };
}
