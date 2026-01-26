# Spreadsheet Editing Proposal

## Objective
Enable the AI agent to read, edit, and create spreadsheet files (Excel `.xlsx` and CSV `.csv`).

## Proposed Solution

### 1. Dependencies
We will add the [SheetJS (xlsx)](https://docs.sheetjs.com/) library to `@sila/core`. This is a robust, battle-tested library for parsing and writing spreadsheet formats in JavaScript environments.

```bash
npm install xlsx
```

### 2. File Handling
We will update `packages/core/src/agents/tools/fileUtils.ts` to recognize `.xlsx` and `.csv` mime types, allowing the agent to target these files.

### 3. New Tool: `edit_spreadsheet`
We will create a new tool `packages/core/src/agents/tools/toolSpreadsheet.ts` that provides the following operations:

*   **`read`**: Read a specific sheet from a file.
    *   *Input:* `path` (string), `sheet_name` (optional).
    *   *Output:* CSV-formatted string (token efficient) or JSON.
*   **`append`**: Add rows to the end of a sheet.
    *   *Input:* `path`, `data` (array of arrays or array of objects), `sheet_name`.
*   **`update_cell`**: Update specific cells.
    *   *Input:* `path`, `cell` (e.g., "A1"), `value`, `sheet_name`.
*   **`create`**: Create a new empty spreadsheet or CSV.
    *   *Input:* `path`, `sheet_name` (optional).

### 4. Integration
The tool will be registered in `packages/core/src/agents/AgentServices.ts` so it is available to the Chat Agent.

### 5. Implementation Details
*   **Reading:** The tool will fetch the file binary from the `Space` (similar to `toolRead`), parse it with `xlsx.read`, and return the content.
*   **Writing:** The tool will modify the workbook object in memory and write the binary buffer back to the `Space` (similar to `toolWriteToFile`).
*   **Concurrency:** We will rely on the existing file versioning in `Space` to handle basic conflicts, though cell-level locking is out of scope for this simple implementation.

## Future Work: Google Sheets
Direct Google Sheets integration requires OAuth2 authentication and the `googleapis` library. This is significantly more complex due to credential management.
**Recommendation:** Start with local file support (`.xlsx` handled by the agent). If users need to edit Google Sheets, they can download them as `.xlsx`, upload to Sila, let the agent edit, and re-upload to Google Drive.
