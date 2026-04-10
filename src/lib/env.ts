import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema — grouped by domain
// ---------------------------------------------------------------------------

const databaseSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL is required and must be a valid URL"),
  DATABASE_REPLICA_URL: z.string().url().optional(),
});

const authSchema = z.object({
  AUTH_SECRET: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z.string().optional(),
});

const adminSchema = z.object({
  ADMIN_LOGIN: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_IP_WHITELIST: z.string().optional(),
});

const googleOAuthSchema = z.object({
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  GOOGLE_SERVER_CLIENT_ID: z.string().optional(),
  GOOGLE_IOS_CLIENT_ID: z.string().optional(),
  GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),
});

const redisSchema = z.object({
  REDIS_URL: z.string().url().optional(),
});

const aiCortexSchema = z.object({
  AI_CORTEX_URL: z.string().url().default("http://orchestrator:8120"),
  AI_CORTEX_PUBLIC_URL: z.string().url().default("https://leema.kz"),
  AI_CORTEX_AUTH_TOKEN: z.string().optional(),
  ORCHESTRATOR_URL: z.string().url().optional(),
  UNIFIED_MCP_URL: z.string().url().optional(),
});

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

const freedomPaySchema = z.object({
  FREEDOM_PAY_MERCHANT_ID: z.string().default(""),
  FREEDOM_PAY_SECRET_KEY: z.string().default(""),
  FREEDOM_PAY_API_URL: z.string().url().default("https://api.freedompay.kz"),
  FREEDOM_PAY_RESULT_URL: z.string().default(""),
  FREEDOM_PAY_SUCCESS_URL: z.string().default(""),
  FREEDOM_PAY_FAILURE_URL: z.string().default(""),
  FREEDOM_PAY_TESTING_MODE: z
    .enum(["0", "1"])
    .optional()
    .transform((v) => (v === "1" ? "1" : undefined)),
});

const emailSchema = z.object({
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const s3Schema = z.object({
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
});

const pushSchema = z.object({
  FCM_PROJECT_ID: z.string().optional(),
  FCM_SERVICE_ACCOUNT_KEY: z.string().optional(),
});

const sentrySchema = z.object({
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

const observabilitySchema = z.object({
  LOG_FORMAT: z.enum(["json", "text"]).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  METRICS_TOKEN: z.string().optional(),
});

const infraSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_RUNTIME: z.string().optional(),
  SHUTDOWN_DRAIN_MS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 15_000)),
  TRUSTED_INTERNAL_HOSTS: z
    .string()
    .default("orchestrator,leemadb,embedding-proxy,db,redis,pgbouncer"),
  CRON_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// Combined schema
// ---------------------------------------------------------------------------

const envSchema = databaseSchema
  .merge(authSchema)
  .merge(adminSchema)
  .merge(googleOAuthSchema)
  .merge(redisSchema)
  .merge(aiCortexSchema)
  .merge(stripeSchema)
  .merge(freedomPaySchema)
  .merge(emailSchema)
  .merge(s3Schema)
  .merge(pushSchema)
  .merge(sentrySchema)
  .merge(observabilitySchema)
  .merge(infraSchema)
  .superRefine((data, ctx) => {
    // At least one auth secret must be provided in production
    if (
      data.NODE_ENV === "production" &&
      !data.AUTH_SECRET &&
      !data.NEXTAUTH_SECRET
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "AUTH_SECRET or NEXTAUTH_SECRET is required in production",
        path: ["AUTH_SECRET"],
      });
    }
  });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Env = z.infer<typeof envSchema>;

// Re-export schema for testing or external validation
export { envSchema };

// ---------------------------------------------------------------------------
// Lazy singleton
// ---------------------------------------------------------------------------

let cached: Env | undefined;

/**
 * Validates `process.env` against the schema and returns a typed object.
 *
 * Throws `ZodError` with a human-readable summary when validation fails.
 * Result is cached — subsequent calls return the same object without
 * re-parsing.
 *
 * @param forceRevalidate  Pass `true` to discard the cache and re-parse
 *                         (useful in tests).
 */
export function validateEnv(forceRevalidate = false): Env {
  if (cached && !forceRevalidate) return cached;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Environment validation failed:\n${formatted}\n\n` +
        "Check your .env file or environment variables.",
    );
  }

  cached = result.data;
  return cached;
}

/**
 * Typed, lazily-validated environment object.
 *
 * Access any property and the full schema will be validated on first read.
 * Subsequent reads are free (cached).
 *
 * ```ts
 * import { env } from "@/lib/env";
 * console.log(env.DATABASE_URL);
 * ```
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    const validated = validateEnv();
    return validated[prop as keyof Env];
  },

  has(_target, prop: string) {
    const validated = validateEnv();
    return prop in validated;
  },

  ownKeys() {
    const validated = validateEnv();
    return Object.keys(validated);
  },

  getOwnPropertyDescriptor(_target, prop: string) {
    const validated = validateEnv();
    if (prop in validated) {
      return {
        configurable: true,
        enumerable: true,
        value: validated[prop as keyof Env],
      };
    }
    return undefined;
  },
});
