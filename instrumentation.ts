// Next.js server instrumentation hook. Runs once per server process at
// boot, before any request handler. We use it to start long-running
// services (close-watcher) that the singleton claim route can't bootstrap.
//
// Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// Edge runtime cannot host the watcher (no persistent connections), so we
// gate on NEXT_RUNTIME === "nodejs".

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initServer } = await import("@/lib/server-init");
  initServer();
}
