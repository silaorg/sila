import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_API_PORT = 39900;
const DEFAULT_DASHBOARD_PORT = 39901;

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {string} name
 */
function readPort(value, fallback, name) {
  const port = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a port from 1 to 65535.`);
  }
  return port;
}

/** @param {NodeJS.ProcessEnv} [environment] */
export function readDashboardProxyOptions(environment = process.env) {
  const host = environment.HESWE_DEV_HOST || DEFAULT_HOST;
  const apiPort = readPort(environment.HESWE_API_PORT, DEFAULT_API_PORT, "HESWE_API_PORT");
  const dashboardPort = readPort(
    environment.HESWE_DASHBOARD_PORT,
    DEFAULT_DASHBOARD_PORT,
    "HESWE_DASHBOARD_PORT",
  );
  const apiUrl = new URL(
    environment.HESWE_API_URL || `http://${host}:${apiPort}`,
  );
  if (apiUrl.protocol !== "http:" && apiUrl.protocol !== "https:") {
    throw new Error("HESWE_API_URL must use http:// or https://.");
  }

  return {
    host,
    apiUrl: apiUrl.origin,
    dashboardPort,
  };
}

/**
 * @param {{
 *   environment?: NodeJS.ProcessEnv;
 *   host?: string;
 *   apiUrl?: string;
 *   dashboardPort?: number;
 * }} [input]
 */
export async function startDashboardProxy(input = {}) {
  const { environment, ...overrides } = input;
  const options = {
    ...readDashboardProxyOptions(environment),
    ...overrides,
  };

  const server = await createServer({
    appType: "custom",
    clearScreen: false,
    configFile: false,
    optimizeDeps: {
      noDiscovery: true,
    },
    server: {
      hmr: false,
      host: options.host,
      port: options.dashboardPort,
      strictPort: true,
      watch: null,
      proxy: {
        "/": {
          target: options.apiUrl,
          changeOrigin: false,
          ws: true,
        },
      },
    },
  });
  await server.listen();
  return server;
}

const isMainModule =
  process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const options = readDashboardProxyOptions();
  const server = await startDashboardProxy(options);
  server.printUrls();
}
