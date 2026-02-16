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
    // Don't send 4xx client errors to Sentry
    if (event.contexts?.response) {
      const status = (event.contexts.response as Record<string, unknown>).status_code as number;
      if (status >= 400 && status < 500) return null;
    }
    return event;
  },
});
