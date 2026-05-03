// Persistent-host entry point for the close-watcher.
//
// This file is the Render service's main process. It boots the same
// long-running services that instrumentation.ts boots on Vercel
// (close-watcher + WS connection), but in a plain Node context that does
// not die on request idle.
//
// Logging is structured JSON — every line is { timestamp, level, message, ... }
// so Render's log filter can do its job. No raw object serialization.

import http from "node:http";

import { connect, disconnect, getAdrenaWsClient } from "@/lib/adrena-ws";
import { stop as stopCloseWatcher } from "@/lib/close-watcher";
import { initServer } from "@/lib/server-init";

// ---------------------------------------------------------------------------
// Structured logger
// ---------------------------------------------------------------------------

type LogLevel = "info" | "warn" | "error" | "fatal";

function log(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {},
): void {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  const stream = level === "error" || level === "fatal" ? process.stderr : process.stdout;
  stream.write(JSON.stringify(line) + "\n");
}

// ---------------------------------------------------------------------------
// Required env validation — fail loud, never run blind.
// ---------------------------------------------------------------------------

const REQUIRED_ENV = [
  "ADRENA_COMPETITION_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const;

const OPTIONAL_ENV = [
  "ADRENA_COMPETITION_BASE_URL",
  "ADRENA_COMPETITION_WS_URL",
  "ADRENA_DATAPI_BASE_URL",
  "ADRENA_API_MAX_RETRIES",
  "PORT",
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    log("fatal", "missing_required_env", { missing });
    process.exit(1);
  }
}

function envVarsPresent(): string[] {
  return [...REQUIRED_ENV, ...OPTIONAL_ENV].filter((k) =>
    Boolean(process.env[k]),
  );
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

try {
  validateEnv();

  log("info", "watcher_starting", {
    node_version: process.version,
    env_vars_present: envVarsPresent(),
  });

  initServer();
  const ws = getAdrenaWsClient();

  // Lifecycle log emitters — translate WS events into our structured format.
  ws.on("info", (payload) => {
    log("info", "ws_connected", { program_id: payload.programId });
  });
  ws.on("reconnecting", ({ attempt, delayMs }) => {
    const last = ws.lastMessageTimestamp();
    const downtime_ms = last ? Date.now() - last : null;
    log("warn", "ws_reconnecting", {
      attempt,
      delay_ms: delayMs,
      downtime_ms,
    });
  });
  ws.on("gap_warning", ({ downtimeMs, consecutiveFailures }) => {
    log("warn", "ws_gap_detected", {
      downtime_ms: downtimeMs,
      consecutive_failures: consecutiveFailures,
    });
  });

  log("info", "ws_connecting");

  // ---------------------------------------------------------------------------
  // HTTP server (health probe + Render's root probe)
  // ---------------------------------------------------------------------------

  const PORT = Number(process.env.PORT ?? 8080);

  function healthBody(): { status: number; body: Record<string, unknown> } {
    const state = ws.getState();
    const healthy = state === "connected" || state === "degraded";
    return {
      status: healthy ? 200 : 503,
      body: {
        state,
        last_event_at: ws.lastMessageTimestamp(),
        uptime_seconds: Math.floor(process.uptime()),
      },
    };
  }

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
      const { status, body } = healthBody();
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  server.listen(PORT, () => {
    log("info", "http_listening", { port: PORT });
  });

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  let shuttingDown = false;
  function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    log("info", "shutdown_initiated", { signal });

    stopCloseWatcher();
    disconnect();
    server.close();

    setTimeout(() => {
      log("info", "shutdown_complete");
      process.exit(0);
    }, 5_000).unref();
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Crash-on-unhandled. Render's supervisor restarts the process on exit;
  // a visible restart counter is far better than a silently-degraded
  // watcher that appears alive but isn't processing events. Until we have
  // alerting, fail loud is the only signal we get.
  process.on("uncaughtException", (err) => {
    log("fatal", "uncaught_exception", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    log("fatal", "unhandled_rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    process.exit(1);
  });
} catch (err) {
  log("fatal", "boot_failed", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
}
