import * as XLSX from "xlsx";
import type { LangToolWithHandler } from "aiwrapper";
import type { Space } from "../../spaces/Space";
import type { AppTree } from "../../spaces/AppTree";
import { ensureFileParent, inferTextMimeFromPath } from "./fileUtils";
import type { AgentTool } from "./AgentTool";
import { Vertex } from "reptree";
import { parseFileUri, getRootForPath } from "../../spaces/files/filePathUtils";

interface SpreadsheetToolResult {
  status: "completed" | "failed";
  output: string;
}

export const toolSpreadsheet: AgentTool = {
  name: "edit_spreadsheet",
  description: "Read, edit, or create spreadsheet files (Excel .xlsx or .csv). Operations: read, append, update_cell, create.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["read", "append", "update_cell", "create"],
        description: "The operation to perform."
      },
      path: {
        type: "string",
        description: "The path to the file (e.g., 'file:data.xlsx')."
      },
      sheet_name: {
        type: "string",
        description: "Name of the sheet to target. Defaults to the first sheet."
      },
      data: {
        type: "string",
        description: "For 'append': JSON string of array of arrays/objects. For 'update_cell': the value to write."
      },
      cell: {
        type: "string",
        description: "For 'update_cell': The cell address (e.g., 'A1')."
      }
    },
    required: ["action", "path"]
  },
  getTool(services, appTree) {
    return buildSpreadsheetTool(services.space, appTree, this.description, this.parameters);
  }
};

function buildSpreadsheetTool(
  space: Space,
  appTree: AppTree | undefined,
  description?: string,
  parameters?: LangToolWithHandler["parameters"]
): LangToolWithHandler {
  return {
    name: "edit_spreadsheet",
    description: description || "Edit spreadsheets",
    parameters: parameters!,
    handler: async (args: Record<string, any>): Promise<SpreadsheetToolResult> => {
      const action = args.action as string;
      const path = args.path as string;
      const sheetName = args.sheet_name as string | undefined;
      let data: any = args.data;
      const cell = args.cell as string | undefined;

      // Normalize path
      let uri = path;
      if (!uri.startsWith("file:") && !uri.startsWith("/")) {
        uri = `file:${uri}`;
      } else if (uri.startsWith("/")) {
        uri = `file://${uri}`;
      }

      try {
        if (action === "create") {
          await handleCreate(space, appTree, uri, sheetName);
          return { status: "completed", output: `Created spreadsheet at ${path}` };
        }

        // For other actions, we need to load the file
        const { workbook, vertex } = await loadWorkbook(space, appTree, uri);

        let targetSheetName = sheetName || workbook.SheetNames[0];
        if (!workbook.Sheets[targetSheetName] && action !== "create") {
            // If specific sheet requested but not found, maybe create it?
            // For now, let's fail or default.
             if (sheetName) throw new Error(`Sheet '${sheetName}' not found.`);
             targetSheetName = workbook.SheetNames[0]; // Should exist if valid workbook
        }

        let worksheet = workbook.Sheets[targetSheetName];

        if (action === "read") {
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          return { status: "completed", output: csv };
        }

        if (action === "append") {
          if (!data) throw new Error("Missing 'data' for append operation.");
          let parsedData;
          try {
             parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          } catch {
             parsedData = data; // assume string value if not json
             // but append expects array usually.
             // If string is passed and not json, wrap in array?
             if (!Array.isArray(parsedData)) parsedData = [[parsedData]];
          }

          let origin: any = -1;
          const ref = worksheet['!ref'];
          if (!ref) {
              origin = "A1";
          } else {
              const range = XLSX.utils.decode_range(ref);
              // If range is exactly A1 and A1 is empty, start at A1
              if (range.s.r === 0 && range.e.r === 0 && range.s.c === 0 && range.e.c === 0) {
                  const a1 = worksheet["A1"];
                  if (!a1 || a1.v === undefined) {
                      origin = "A1";
                  }
              }
          }

          if (parsedData.length > 0 && Array.isArray(parsedData[0])) {
             XLSX.utils.sheet_add_aoa(worksheet, parsedData, { origin });
          } else {
             XLSX.utils.sheet_add_json(worksheet, parsedData, { skipHeader: true, origin });
          }

          await saveWorkbook(space, vertex, workbook, uri);
          return { status: "completed", output: "Appended data." };
        }

        if (action === "update_cell") {
          if (!cell) throw new Error("Missing 'cell' address for update_cell.");
          if (data === undefined) throw new Error("Missing 'data' value for update_cell.");

          // update logic
          const cellAddress = XLSX.utils.decode_cell(cell);
          /* add cell to worksheet */
          XLSX.utils.sheet_add_aoa(worksheet, [[data]], { origin: cell });

          await saveWorkbook(space, vertex, workbook, uri);
          return { status: "completed", output: `Updated cell ${cell}.` };
        }

        return { status: "failed", output: `Unknown action: ${action}` };

      } catch (error: any) {
        return { status: "failed", output: `Error: ${error.message}` };
      }
    }
  };
}

async function loadWorkbook(space: Space, appTree: AppTree | undefined, uri: string) {
    const { isWorkspacePath, segments } = parseFileUri(uri);
    const root = getRootForPath(space, appTree, isWorkspacePath);

    // traverse to find vertex
    let current = root;
    for (const segment of segments) {
        const child = current.children?.find(c => c.name === segment);
        if (!child) throw new Error(`File not found: ${uri}`);
        current = child;
    }
    const vertex = current;
    const contentId = vertex.getProperty("id") as string;

    if (!space.fileStore) throw new Error("No file store.");
    const buffer = await space.fileStore.get(contentId);
    if (!buffer) throw new Error("Empty file content.");

    const workbook = XLSX.read(buffer, { type: "buffer" });
    return { workbook, vertex };
}

async function handleCreate(space: Space, appTree: AppTree | undefined, uri: string, sheetName?: string) {
    const { parent, name } = ensureFileParent(space, appTree, uri);

    // Check if exists
    const existing = parent.children?.find(c => c.name === name);
    if (existing) throw new Error(`File already exists: ${uri}`);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([]);
    // Remove ref so append starts at A1
    delete worksheet['!ref'];
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || "Sheet1");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: uri.endsWith(".csv") ? "csv" : "xlsx" });

    if (!space.fileStore) throw new Error("No file store");
    const mutableId = crypto.randomUUID();
    await space.fileStore.putMutable(mutableId, buffer);

    const mime = uri.endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    parent.newNamedChild(name, {
        name: name,
        id: mutableId,
        mimeType: mime,
        size: buffer.byteLength,
        updatedAt: Date.now()
    });
}

async function saveWorkbook(space: Space, vertex: Vertex, workbook: XLSX.WorkBook, uri: string) {
    const isCsv = uri.endsWith(".csv");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: isCsv ? "csv" : "xlsx" });

    const mutableId = crypto.randomUUID();
    await space.fileStore!.putMutable(mutableId, buffer);

    vertex.setProperty("id", mutableId);
    vertex.setProperty("size", buffer.byteLength);
    vertex.setProperty("updatedAt", Date.now());
}
