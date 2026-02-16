import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Performance
  tracesSampleRate: 0.1,

  // Filter out noisy errors
  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    // Rate limit responses (expected)
    "Too many requests",
  ],

  beforeSend(event) {
    // Filter noisy client errors but keep security-relevant ones (401, 403)
    if (event.contexts?.response) {
      const status = (event.contexts.response as Record<string, unknown>).status_code as number;
      // Drop 404 (not found) and 429 (rate limited) — expected in normal operation
      if (status === 404 || status === 429) return null;
    }
    return event;
  },
});
