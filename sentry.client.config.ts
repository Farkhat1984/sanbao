import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Performance
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0.01, // 1% of sessions
  replaysOnErrorSampleRate: 0.5, // 50% of sessions with errors

  // Filtering
  ignoreErrors: [
    // Browser extensions
    "ResizeObserver loop",
    "Non-Error exception captured",
    // Network issues (expected for SSE)
    "Failed to fetch",
    "NetworkError",
    "AbortError",
    "Load failed",
  ],

  beforeSend(event) {
    // Strip PII from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => {
        if (b.data?.url) {
          try {
            const url = new URL(b.data.url);
            url.searchParams.delete("token");
            url.searchParams.delete("key");
            b.data.url = url.toString();
          } catch {
            // ignore
          }
        }
        return b;
      });
    }
    return event;
  },
});
