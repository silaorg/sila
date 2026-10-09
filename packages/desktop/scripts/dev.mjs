import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import electron from "electron";
import { createServer, preview } from "vite";

const desktopRoot = fileURLToPath(new URL("../", import.meta.url));
const built = process.env.HESWE_DESKTOP_BUILT === "1";
const apiUrl = process.env.HESWE_API_URL || "http://127.0.0.1:39900";
const desktopUrl = process.env.HESWE_DASHBOARD_URL || "http://127.0.0.1:39901";
const startup = new AbortController();
let renderer;
let child;
let closing;

async function close(code = 0) {
  if (closing) return closing;
  startup.abort();
  closing = (async () => {
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
      if (child.connected) child.send("heswe-desktop:stop", (error) => {
        if (error) child.kill();
      });
      else child.kill();
      const forceQuit = setTimeout(() => child.kill("SIGKILL"), 5_000);
      forceQuit.unref();
      await exited;
      clearTimeout(forceQuit);
    }
    if (renderer) {
      if (built) {
        await new Promise((resolveClose) => {
          renderer.httpServer.close(resolveClose);
          renderer.httpServer.closeAllConnections();
        });
      } else {
        await renderer.close();
      }
    }
    process.exitCode = code;
  })();
  return closing;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => {
    startup.abort();
    if (renderer) void close();
  });
}

async function waitForApi() {
  const deadline = Date.now() + 60_000;
  while (!startup.signal.aborted && Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/api/auth/get-session`, {
        signal: AbortSignal.any([startup.signal, AbortSignal.timeout(2_000)]),
      });
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {
      if (startup.signal.aborted) return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  if (!startup.signal.aborted) throw new Error("The Heswe API did not become ready within 60 seconds.");
}

try {
  if (built && !existsSync(new URL("../build/index.html", import.meta.url))) {
    throw new Error("Build the desktop client first with npm run build:desktop.");
  }
  const options = {
    root: desktopRoot,
    configFile: fileURLToPath(new URL("../vite.config.js", import.meta.url)),
  };
  renderer = built ? await preview(options) : await createServer(options);
  if (!built) await renderer.listen();
  await waitForApi();
  if (startup.signal.aborted) {
    await close();
  } else {
    const environment = { ...process.env, HESWE_DESKTOP_URL: desktopUrl };
    delete environment.ELECTRON_RUN_AS_NODE;
    child = spawn(electron, [desktopRoot], {
      cwd: desktopRoot,
      env: environment,
      detached: process.platform !== "win32",
      stdio: ["inherit", "inherit", "inherit", "ipc"],
    });
    child.once("error", (error) => {
      console.error(`Unable to launch Heswe desktop: ${error.message}`);
      void close(1);
    });
    child.once("exit", (code) => {
      if (!closing) void close(code ?? 1);
    });
    console.log(`Heswe desktop started${built ? " from the built client" : " with live reload"}. Quit the app to stop its local API.`);
  }
} catch (error) {
  console.error(`Unable to start Heswe desktop: ${error.message}`);
  await close(1);
}
