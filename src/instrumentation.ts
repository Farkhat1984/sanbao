/**
 * Next.js instrumentation hook.
 * Runs once when the server starts — registers workers, shutdown handlers.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run server-side (not in Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Register graceful shutdown handlers (SIGTERM / SIGINT)
    await import("@/lib/shutdown");

    // Register BullMQ workers (webhook, email)
    await import("@/lib/workers");

    console.log("[instrumentation] Workers and shutdown handlers registered");
  }
}
