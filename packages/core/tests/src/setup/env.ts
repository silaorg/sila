/**
 * Retrieve an environment variable from process.env.
 * 
 * Note: .env files are loaded automatically when tests start via setup-worker.ts.
 * This function simply provides a convenient interface with placeholder filtering.
 * 
 * Optionally filters out placeholder values (e.g. "your_openai_api_key_here").
 */
export function getEnvVar(key: string, placeholder?: string): string | undefined {
  const value = process.env[key];
  if (!value) {
    return undefined;
  }

  // Filter out placeholder values
  if (placeholder && value === placeholder) {
    return undefined;
  }

  return value;
}

