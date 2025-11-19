import { readFileSync } from 'node:fs';
import path from 'node:path';

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Retrieve an environment variable, falling back to the local .env file when available.
 * Optionally filters out placeholder values (e.g. "your_openai_api_key_here").
 */
export function getEnvVar(key: string, placeholder?: string): string | undefined {
  const direct = process.env[key];
  if (direct && (!placeholder || direct !== placeholder)) {
    return direct;
  }

  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const regex = new RegExp(`^${key}=([^\\r\\n]+)`, 'm');
    const match = envContent.match(regex);
    const value = match?.[1]?.trim();
    if (value && (!placeholder || value !== placeholder)) {
      return stripWrappingQuotes(value);
    }
  } catch {
    // Ignore missing .env files – they are optional in CI/local workflows.
  }

  return undefined;
}

