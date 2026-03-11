import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { normalizePath } from "./file-utils.js";
import {
  getWorkbookSheetNames,
  loadWorkbookWithFallback,
  resolveWorksheet,
} from "./spreadsheet-utils.js";

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toLineSlice(text, start, limit) {
  const lines = String(text).split("\n");
  const safeStart = Math.max(0, Number(start) || 0);
  const safeLimit = Math.max(1, Number(limit) || 100);
  const slicedLines = lines.slice(safeStart, safeStart + safeLimit);
  return {
    totalLines: lines.length,
    content: slicedLines.join("\n"),
  };
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function toLineLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
}

function looksLikeExcelPath(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  return ext === ".xlsx" || ext === ".xls" || ext === ".csv";
}

function isDocPath(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  return ext === ".docx" || ext === ".doc";
}

function isPdfPath(fullPath) {
  return path.extname(fullPath).toLowerCase() === ".pdf";
}

function toDisplayCellValue(value) {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if ("formula" in value && typeof value.formula === "string") {
    return `=${value.formula}`;
  }
  if ("result" in value) {
    return value.result;
  }
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => String(part?.text || "")).join("");
  }
  if ("text" in value && typeof value.text === "string") {
    return value.text;
  }
  if ("hyperlink" in value) {
    return value.text || value.hyperlink;
  }
  return value;
}

function toResultCellValue(value) {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if ("result" in value) return value.result;
  if ("formula" in value && typeof value.formula === "string") {
    return `=${value.formula}`;
  }
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => String(part?.text || "")).join("");
  }
  if ("text" in value && typeof value.text === "string") {
    return value.text;
  }
  if ("hyperlink" in value) {
    return value.text || value.hyperlink;
  }
  return value;
}

function isMeaningfulCellValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function isWorksheetRowEmpty(row) {
  let hasValue = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (isMeaningfulCellValue(toDisplayCellValue(cell.value))) {
      hasValue = true;
    }
  });
  return !hasValue;
}

function detectHeaderRowIndex(worksheet, totalRows, headerRow) {
  if (typeof headerRow === "number" && Number.isFinite(headerRow)) {
    return Math.max(1, Math.trunc(headerRow));
  }
  if (typeof headerRow === "string" && headerRow !== "auto") {
    const parsed = Number(headerRow);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.trunc(parsed));
    }
  }

  const scanLimit = Math.min(50, Math.max(1, totalRows));
  for (let rowIndex = 1; rowIndex <= scanLimit; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const nextRow = worksheet.getRow(rowIndex + 1);
    if (row.actualCellCount >= 2 && nextRow.actualCellCount >= 1) {
      return rowIndex;
    }
  }
  return 1;
}

function buildHeaders(worksheet, headerRowIndex) {
  const row = worksheet.getRow(headerRowIndex);
  const values = Array.isArray(row.values) ? row.values : [];
  const headers = [];
  for (let columnIndex = 1; columnIndex < values.length; columnIndex += 1) {
    const raw = values[columnIndex];
    const key = String(raw ?? "").trim();
    headers[columnIndex] = key || `col_${columnIndex}`;
  }
  return headers;
}

function toHyperFormulaCellValue(value) {
  if (value == null) return null;
  if (typeof value === "object") {
    if ("formula" in value && typeof value.formula === "string") {
      return `=${value.formula}`;
    }
    if ("result" in value) {
      return value.result;
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => String(part?.text || "")).join("");
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("hyperlink" in value) {
      return value.text || value.hyperlink;
    }
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

async function createHyperFormulaInstance(worksheet) {
  const { HyperFormula } = await import("hyperformula");
  const sheetData = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const rowData = [];
    const columnCount = Math.max(row.cellCount, row.actualCellCount);
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      const cell = row.getCell(columnIndex);
      rowData[columnIndex - 1] = toHyperFormulaCellValue(cell.value);
    }
    sheetData[rowNumber - 1] = rowData;
  });

  if (sheetData.length === 0) {
    sheetData.push([]);
  }

  return HyperFormula.buildFromArray(sheetData, {
    licenseKey: "gpl-v3",
  });
}

function normalizeComputedValue(value) {
  if (!value || typeof value !== "object") {
    return value;
  }
  if ("message" in value && typeof value.message === "string") {
    return value.message;
  }
  if ("value" in value && value.value != null) {
    return value.value;
  }
  return String(value);
}

function getCellValue(cell, rowIndex, columnIndex, valueMode, hfInstance) {
  if (valueMode === "compute" && hfInstance) {
    const computed = hfInstance.getCellValue({ sheet: 0, row: rowIndex, col: columnIndex });
    return normalizeComputedValue(computed);
  }
  if (valueMode === "result") {
    return toResultCellValue(cell.value);
  }
  return toDisplayCellValue(cell.value);
}

async function readSpreadsheet(fullPath, args) {
  const {
    start = 0,
    limit = 200,
    sheet,
    listSheets = false,
    asObjects = false,
    headerRow,
    skipEmptyRows,
    fillMissingCells,
    valueMode = "raw",
  } = args;

  const ext = path.extname(fullPath).toLowerCase();
  if (ext === ".xls") {
    return { error: "Unsupported format .xls. Please export as .xlsx or .csv." };
  }

  const workbook = new ExcelJS.Workbook();
  const loadResult = await loadWorkbookWithFallback(workbook, fullPath, ext);

  if (listSheets) {
    const sheetNames = getWorkbookSheetNames(workbook);
    return {
      type: "excel",
      path: fullPath,
      sheets: sheetNames,
      defaultSheet: sheetNames[0] || null,
      warnings: loadResult.warning ? [loadResult.warning] : undefined,
    };
  }

  const worksheet = resolveWorksheet(workbook, sheet);

  if (!worksheet) {
    const names = getWorkbookSheetNames(workbook);
    if (sheet !== undefined && sheet !== null && String(sheet).length > 0) {
      return { error: `Sheet '${sheet}' not found. Available: ${names.join(", ") || "(none)"}` };
    }
    return { error: "No readable sheets found in workbook." };
  }

  const totalRows = worksheet.rowCount;
  const actualRowCount = worksheet.actualRowCount;
  const safeStart = toPositiveInteger(start, 0);
  const safeLimit = toLineLimit(limit, 200);
  const shouldAsObjects = Boolean(asObjects);
  const shouldSkipEmptyRows = skipEmptyRows === undefined ? shouldAsObjects : Boolean(skipEmptyRows);
  const shouldFillMissingCells =
    fillMissingCells === undefined ? shouldAsObjects : Boolean(fillMissingCells);

  let detectedHeaderRow = null;
  let headers = null;
  let startRow = safeStart + 1;

  if (shouldAsObjects) {
    detectedHeaderRow = detectHeaderRowIndex(worksheet, totalRows, headerRow);
    headers = buildHeaders(worksheet, detectedHeaderRow);
    if (safeStart === 0 || startRow <= detectedHeaderRow) {
      startRow = detectedHeaderRow + 1;
    }
  }

  const rowsToRead = [];
  for (
    let rowIndex = Math.max(1, startRow);
    rowIndex <= worksheet.rowCount && rowsToRead.length < safeLimit;
    rowIndex += 1
  ) {
    const row = worksheet.getRow(rowIndex);
    if (shouldSkipEmptyRows && isWorksheetRowEmpty(row)) {
      continue;
    }
    rowsToRead.push(row);
  }

  let hfInstance = null;
  let effectiveValueMode = valueMode;
  if (valueMode === "compute") {
    try {
      hfInstance = await createHyperFormulaInstance(worksheet);
    } catch {
      effectiveValueMode = "result";
    }
  }

  const data = [];
  for (const row of rowsToRead) {
    if (shouldAsObjects && headers) {
      const objectRow = {};
      if (shouldFillMissingCells) {
        for (let columnIndex = 1; columnIndex < headers.length; columnIndex += 1) {
          const key = headers[columnIndex];
          if (key) {
            objectRow[key] = null;
          }
        }
      }

      const maxColumns = Math.max(row.cellCount, row.actualCellCount, headers.length - 1);
      for (let columnIndex = 1; columnIndex <= maxColumns; columnIndex += 1) {
        const key = headers[columnIndex];
        if (!key) continue;

        const cell = row.getCell(columnIndex);
        const value = getCellValue(
          cell,
          row.number - 1,
          columnIndex - 1,
          effectiveValueMode,
          hfInstance,
        );

        if (!shouldFillMissingCells && !isMeaningfulCellValue(value)) {
          continue;
        }
        objectRow[key] = value ?? null;
      }
      data.push(objectRow);
      continue;
    }

    const rowValues = [];
    const maxColumns = Math.max(row.cellCount, row.actualCellCount);
    for (let columnIndex = 1; columnIndex <= maxColumns; columnIndex += 1) {
      const cell = row.getCell(columnIndex);
      rowValues.push(
        getCellValue(cell, row.number - 1, columnIndex - 1, effectiveValueMode, hfInstance),
      );
    }
    data.push(rowValues);
  }

  return {
    type: "excel",
    path: fullPath,
    sheet: worksheet.name,
    totalRows,
    actualRowCount,
    headerRow: shouldAsObjects ? detectedHeaderRow : undefined,
    valueMode: effectiveValueMode,
    warnings: loadResult.warning ? [loadResult.warning] : undefined,
    data,
  };
}

async function extractPdfText(bytes) {
  const document = await pdfjsLib.getDocument({
    data: bytes,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  const maxPages = 50;
  const pageLimit = Math.min(document.numPages, maxPages);
  const parts = [];

  for (let pageIndex = 1; pageIndex <= pageLimit; pageIndex += 1) {
    const page = await document.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    parts.push(`# Page ${pageIndex}\n${pageText}`);
  }

  if (document.numPages > maxPages) {
    parts.push(`# Note\nStopped at page ${maxPages} of ${document.numPages}.`);
  }

  return parts.join("\n\n").trim();
}

async function readWordDocument(fullPath, start, limit) {
  const buffer = await fs.promises.readFile(fullPath);
  const result = await mammoth.extractRawText({ buffer });
  const sliced = toLineSlice(result.value, start, limit);
  return {
    type: "word",
    path: fullPath,
    warnings: result.messages,
    ...sliced,
  };
}

async function readPdfDocument(fullPath, start, limit) {
  const bytes = new Uint8Array(await fs.promises.readFile(fullPath));
  const text = await extractPdfText(bytes);
  const sliced = toLineSlice(text, start, limit);
  return {
    type: "pdf",
    path: fullPath,
    ...sliced,
  };
}

async function readFromUrl(url, start, limit) {
  const response = await fetch(url);
  if (!response.ok) {
    return { error: `Failed to fetch URL: ${response.status} ${response.statusText}` };
  }

  const contentType = String(response.headers.get("content-type") || "");
  if (contentType.includes("application/pdf") || isPdfPath(url)) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = await extractPdfText(bytes);
    const sliced = toLineSlice(text, start, limit);
    return {
      type: "pdf",
      contentType,
      ...sliced,
    };
  }

  const raw = await response.text();
  const text = contentType.includes("text/html") ? stripHtml(raw) : raw;
  const sliced = toLineSlice(text, start, limit);
  return {
    type: "url",
    contentType,
    ...sliced,
  };
}

export function createToolReadDocument(options = {}) {
  const { baseDir = process.cwd() } = options;

  return {
    name: "read_document",
    description: "Read content from text, spreadsheet, Word, PDF documents, or URLs.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Local file path or URL.",
        },
        start: {
          type: "integer",
          description: "Start line (0-based).",
          default: 0,
        },
        limit: {
          type: "integer",
          description: "Number of lines/rows to return.",
          default: 200,
        },
        sheet: {
          type: "string",
          description: "Worksheet name for Excel files.",
        },
        listSheets: {
          type: "boolean",
          description: "List available worksheet names for Excel files.",
          default: false,
        },
        asObjects: {
          type: "boolean",
          description: "Return spreadsheet rows as objects keyed by header row.",
          default: false,
        },
        headerRow: {
          type: "string",
          description: "Header row number (1-based) or 'auto' for spreadsheets.",
        },
        skipEmptyRows: {
          type: "boolean",
          description: "Skip empty spreadsheet rows.",
        },
        fillMissingCells: {
          type: "boolean",
          description: "Fill missing object fields with null in spreadsheet object mode.",
        },
        valueMode: {
          type: "string",
          enum: ["raw", "result", "compute"],
          description:
            "Spreadsheet value mode: raw formula/value, cached result, or computed result.",
          default: "raw",
        },
      },
      required: ["path"],
    },
    handler: async ({
      path,
      start = 0,
      limit = 200,
      sheet,
      listSheets = false,
      asObjects = false,
      headerRow,
      skipEmptyRows,
      fillMissingCells,
      valueMode = "raw",
    }) => {
      try {
        const safeStart = toPositiveInteger(start, 0);
        const safeLimit = toLineLimit(limit, 200);

        if (isHttpUrl(path)) {
          return await readFromUrl(path, safeStart, safeLimit);
        }

        const fullPath = normalizePath(path, baseDir);
        if (!fs.existsSync(fullPath)) {
          return { error: `File not found: ${path}` };
        }

        if (looksLikeExcelPath(fullPath)) {
          return await readSpreadsheet(fullPath, {
            start: safeStart,
            limit: safeLimit,
            sheet,
            listSheets,
            asObjects,
            headerRow,
            skipEmptyRows,
            fillMissingCells,
            valueMode,
          });
        }

        if (isPdfPath(fullPath)) {
          return await readPdfDocument(fullPath, safeStart, safeLimit);
        }

        if (isDocPath(fullPath)) {
          return await readWordDocument(fullPath, safeStart, safeLimit);
        }

        const text = await fs.promises.readFile(fullPath, "utf8");
        const sliced = toLineSlice(text, safeStart, safeLimit);
        return {
          type: "text",
          path: fullPath,
          ...sliced,
        };
      } catch (error) {
        return { error: `Error reading document: ${error.message}` };
      }
    },
  };
}
