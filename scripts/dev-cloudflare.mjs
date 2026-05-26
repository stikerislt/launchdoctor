import { spawn, execSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Tunnel, bin as cloudflaredBin } from "cloudflared";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_ATTEMPTS = 3;
const PREFERRED_PROXY_PORT = Number(process.env.SHOPIFY_PROXY_PORT || 3458);
const TUNNEL_TIMEOUT_MS = 90_000;
const PROXY_READY_TIMEOUT_MS = 180_000;

function warnIfNamedCloudflaredConfig() {
  const configDir = join(homedir(), ".cloudflared");
  for (const name of ["config.yml", "config.yaml"]) {
    const path = join(configDir, name);
    if (existsSync(path)) {
      console.warn(
        `\nWarning: ${path} exists. Quick tunnels can fail when a named Cloudflare tunnel config is present.`,
      );
      console.warn("Temporarily rename that file if tunnel startup keeps failing.\n");
      return;
    }
  }
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(true));
    server.listen({ port, host: "localhost" }, () => {
      server.close(() => resolve(false));
    });
  });
}

function findFreePort(startPort, attempts = 20) {
  return new Promise((resolve, reject) => {
    const tryPort = async (port, remaining) => {
      if (remaining <= 0) {
        reject(new Error(`No free port found near ${startPort}. Stop stale dev processes and retry.`));
        return;
      }

      if (!(await isPortListening(port))) {
        resolve(port);
        return;
      }

      tryPort(port + 1, remaining - 1);
    };

    tryPort(startPort, attempts);
  });
}

function releasePort(port) {
  if (process.platform === "win32") {
    try {
      const output = execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
        { encoding: "utf8" },
      ).trim();

      for (const pidText of output.split(/\s+/)) {
        const pid = Number(pidText);
        if (!pid || pid === process.pid) continue;
        console.log(`Releasing port ${port} (stopping stale PID ${pid})…`);
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      }
    } catch {
      // Port is already free or cannot be queried.
    }
    return;
  }

  try {
    execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, { stdio: "ignore" });
  } catch {
    // Port is already free or lsof is unavailable.
  }
}

async function resolveProxyPort() {
  releasePort(PREFERRED_PROXY_PORT);

  if (!(await isPortListening(PREFERRED_PROXY_PORT))) {
    return PREFERRED_PROXY_PORT;
  }

  const fallback = await findFreePort(PREFERRED_PROXY_PORT + 1);
  console.warn(
    `Port ${PREFERRED_PROXY_PORT} is still in use. Using ${fallback} instead (set SHOPIFY_PROXY_PORT to override).\n`,
  );
  return fallback;
}

function waitForTunnelUrl(tunnel) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for Cloudflare tunnel URL."));
    }, TUNNEL_TIMEOUT_MS);

    tunnel.once("url", (url) => {
      clearTimeout(timer);
      resolve(url);
    });
    tunnel.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForShopifyProxy(child, port, timeoutMs) {
  const marker = `Proxy server started on port ${port}`;
  const started = Date.now();
  let buffer = "";

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for Shopify proxy on port ${port}. Check the CLI output for startup errors.`,
        ),
      );
    }, timeoutMs);

    const onData = (chunk) => {
      buffer += chunk.toString();
      if (buffer.includes(marker)) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onData);
        resolve();
      } else if (buffer.includes("EADDRINUSE")) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onData);
        reject(new Error(`Port ${port} is already in use. Stop other dev sessions and retry.`));
      } else if (Date.now() - started > timeoutMs) {
        clearTimeout(timer);
        reject(new Error(`Timed out waiting for Shopify proxy on port ${port}.`));
      }

      if (buffer.length > 20_000) {
        buffer = buffer.slice(-10_000);
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
  });
}

function runDevAttempt(attempt = 1) {
  if (!existsSync(cloudflaredBin)) {
    console.error(
      "cloudflared binary not found. Run: pnpm install && pnpm approve-builds cloudflared",
    );
    process.exit(1);
  }

  if (attempt === 1) {
    console.log("Launch Doctor dev — Cloudflare tunnel + Shopify CLI");
    console.log(`Using cloudflared: ${cloudflaredBin}`);
    console.log(
      `Preferred proxy port: ${PREFERRED_PROXY_PORT} (override with SHOPIFY_PROXY_PORT)\n`,
    );
  } else {
    console.log(`\nRetrying dev startup (${attempt}/${MAX_ATTEMPTS})…\n`);
  }

  /** @type {import("cloudflared").Tunnel | undefined} */
  let tunnel;
  /** @type {import("node:child_process").ChildProcess | undefined} */
  let shopify;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    tunnel?.stop();
    if (shopify && !shopify.killed) {
      shopify.kill("SIGINT");
    }
  };

  if (attempt === 1) {
    process.once("SIGINT", () => {
      cleanup();
      process.exit(130);
    });
    process.once("SIGTERM", () => {
      cleanup();
      process.exit(143);
    });
  }

  (async () => {
    let proxyPort;

    try {
      proxyPort = await resolveProxyPort();
      const localOrigin = `http://localhost:${proxyPort}`;

      console.log(`Starting Cloudflare tunnel → ${localOrigin}`);
      tunnel = Tunnel.quick(localOrigin, { "--no-autoupdate": true });
      const tunnelUrl = await waitForTunnelUrl(tunnel);
      const tunnelArg = `${tunnelUrl}:${proxyPort}`;

      console.log(`Tunnel ready: ${tunnelUrl}`);
      console.log(`Starting Shopify CLI on proxy port ${proxyPort}…\n`);

      const shopifyArgs = [
        "app",
        "dev",
        `--tunnel-url=${tunnelArg}`,
        ...process.argv.slice(2),
      ];

      shopify = spawn("shopify", shopifyArgs, {
        stdio: ["inherit", "pipe", "pipe"],
        shell: process.platform === "win32",
        env: {
          ...process.env,
          SHOPIFY_CLI_CLOUDFLARED_PATH: cloudflaredBin,
        },
        cwd: root,
      });

      const forwardOutput = (chunk) => process.stdout.write(chunk);
      shopify.stdout?.on("data", forwardOutput);
      shopify.stderr?.on("data", forwardOutput);

      const proxyReady = waitForShopifyProxy(shopify, proxyPort, PROXY_READY_TIMEOUT_MS);

      shopify.on("exit", (code, signal) => {
        cleanup();
        if (signal) {
          process.exit(1);
          return;
        }
        if (code !== 0 && attempt < MAX_ATTEMPTS) {
          setTimeout(() => runDevAttempt(attempt + 1), 3000);
          return;
        }
        process.exit(code ?? 0);
      });

      await proxyReady;

      console.log(
        `\n✓ Shopify proxy is listening on port ${proxyPort}. The tunnel should now work.`,
      );
      console.log(
        "  Wait until the CLI shows Ready, then press p to preview (or refresh if you opened too early).\n",
      );
    } catch (error) {
      cleanup();
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nDev startup failed: ${message}\n`);

      if (attempt < MAX_ATTEMPTS) {
        setTimeout(() => runDevAttempt(attempt + 1), 3000);
        return;
      }

      process.exit(1);
    }
  })();
}

warnIfNamedCloudflaredConfig();
runDevAttempt();
