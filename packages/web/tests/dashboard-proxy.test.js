import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
  readDashboardProxyOptions,
  startDashboardProxy,
} from "../scripts/dashboard-proxy.mjs";

test("reads the allocated API and dashboard ports", () => {
  assert.deepEqual(
    readDashboardProxyOptions({
      HESWE_API_PORT: "43300",
      HESWE_DASHBOARD_PORT: "43301",
    }),
    {
      host: "127.0.0.1",
      apiUrl: "http://127.0.0.1:43300",
      dashboardPort: 43301,
    },
  );
});

test("proxies dashboard requests to the API server without changing the host", async (context) => {
  const api = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({
      host: request.headers.host,
      url: request.url,
    }));
  });
  await new Promise((resolveListen, rejectListen) => {
    api.once("error", rejectListen);
    api.listen(0, "127.0.0.1", () => resolveListen(undefined));
  });
  context.after(() => new Promise((resolveClose) => api.close(resolveClose)));

  const apiAddress = api.address();
  assert.ok(apiAddress && typeof apiAddress === "object");
  const dashboard = await startDashboardProxy({
    apiUrl: `http://127.0.0.1:${apiAddress.port}`,
    dashboardPort: 0,
    host: "127.0.0.1",
  });
  context.after(() => dashboard.close());

  const dashboardAddress = dashboard.httpServer?.address();
  assert.ok(dashboardAddress && typeof dashboardAddress === "object");
  const response = await fetch(
    `http://127.0.0.1:${dashboardAddress.port}/api/workspaces?test=1`,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    host: `127.0.0.1:${dashboardAddress.port}`,
    url: "/api/workspaces?test=1",
  });
});
