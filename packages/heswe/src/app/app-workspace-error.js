export class AppWorkspaceError extends Error {
  /**
   * @param {"invalid_input" | "not_found" | "invalid_data"} code
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(code, message, options) {
    super(message, options);
    this.name = "AppWorkspaceError";
    this.code = code;
  }
}
