// Setup Web Worker polyfill for Node.js test environment
if (typeof Worker === "undefined") {
  // The polyfill will be loaded dynamically in toolRunFlow
  // This file just ensures the environment is ready
}

// Load .env files when tests start
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Test directory root: packages/core/tests
const TEST_DIR = path.resolve(__dirname, '../..');

// Load .env files in order: test dir first, then repo root
const testDirEnvPath = path.join(TEST_DIR, '.env');
const repoRootEnvPath = path.join(process.cwd(), '.env');

// Load test directory .env first (higher priority)
dotenvConfig({ path: testDirEnvPath });
// Load repo root .env (lower priority, won't override already set vars)
dotenvConfig({ path: repoRootEnvPath });

