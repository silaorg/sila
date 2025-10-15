import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';
import { env } from '$env/dynamic/private';
import { config as dotenvConfig } from 'dotenv';
import { citybeanCoffeeDemo as spaceConfig } from '@sila/demo';

export const GET: RequestHandler = async () => {

  // Prefer SvelteKit env; also attempt to load a .env if present (repo root or local)
  const rootEnvPath = path.resolve(process.cwd(), '..', '..', '.env');
  const localEnvPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(rootEnvPath)) {
    dotenvConfig({ path: rootEnvPath });
  } else if (fs.existsSync(localEnvPath)) {
    dotenvConfig({ path: localEnvPath });
  }

  const providerEnvMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    openrouter: 'OPENROUTER_API_KEY'
  };

  const providers = Array.isArray(spaceConfig.providers)
    ? spaceConfig.providers.map(p => {
        const envKey = providerEnvMap[p?.id];
        const mappedValue = envKey ? (env[envKey] ?? process.env[envKey]) : undefined;
        return mappedValue ? { ...p, apiKey: mappedValue } : p;
      })
    : spaceConfig.providers;

  const demoWithKeys = { ...spaceConfig, providers };

  const body = JSON.stringify(demoWithKeys, null, 2);
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
};

