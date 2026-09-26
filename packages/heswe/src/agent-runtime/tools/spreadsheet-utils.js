import fs from "node:fs";

export const XLSX_FALLBACK_IGNORE_NODES = ["tableParts", "extLst"];

export function getWorkbookWorksheets(workbook) {
  return (workbook.worksheets || []).filter(
    (worksheet) => worksheet && typeof worksheet.name === "string" && worksheet.name.length > 0,
  );
}

export function getWorkbookSheetNames(workbook) {
  return getWorkbookWorksheets(workbook).map((worksheet) => worksheet.name);
}

export function normalizeWorksheetName(sheetName, fallback = "Sheet1") {
  if (typeof sheetName === "string") {
    const trimmed = sheetName.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return fallback;
}

export function resolveWorksheet(workbook, requestedSheet) {
  const worksheets = getWorkbookWorksheets(workbook);
  if (worksheets.length === 0) {
    return null;
  }

  if (requestedSheet === undefined || requestedSheet === null || requestedSheet === "") {
    return worksheets[0];
  }

  if (typeof requestedSheet === "number" && Number.isFinite(requestedSheet)) {
    const byId = workbook.getWorksheet(Math.trunc(requestedSheet));
    if (byId) return byId;
  }

  const byName = workbook.getWorksheet(String(requestedSheet));
  return byName || null;
}

export async function loadWorkbookWithFallback(workbook, fullPath, extension) {
  if (extension === ".csv") {
    await workbook.csv.readFile(fullPath);
    return {};
  }

  const bytes = await fs.promises.readFile(fullPath);
  try {
    await workbook.xlsx.load(bytes);
    return {};
  } catch (firstError) {
    try {
      await workbook.xlsx.load(bytes, {
        ignoreNodes: XLSX_FALLBACK_IGNORE_NODES,
      });
      return {
        warning: `Loaded with fallback parser: ${firstError.message}`,
      };
    } catch (fallbackError) {
      throw new Error(
        `Failed to parse .xlsx. primary=${firstError.message}; fallback=${fallbackError.message}`,
      );
    }
  }
}
