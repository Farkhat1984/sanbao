import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Build CSP allowing CDN, Sentry, and AI provider connections
const cdnHost = process.env.CDN_URL ? new URL(process.env.CDN_URL).origin : "";
const sentryDsn = process.env.SENTRY_DSN ?? "";
const sentryHost = sentryDsn ? (() => { try { return new URL(sentryDsn).origin; } catch { return ""; } })() : "";
const cspExtraSrc = [cdnHost, sentryHost].filter(Boolean).join(" ");

const cspValue = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com ${cspExtraSrc}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${cdnHost}`.trim(),
  `font-src 'self' data: ${cdnHost}`.trim(),
  `connect-src 'self' https: ${cspExtraSrc}`.trim(),
  "media-src 'self' blob: https:",
  "frame-src 'self' blob: data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  // CDN: set CDN_URL env to serve static assets from CDN (e.g. https://cdn.example.com)
  assetPrefix: process.env.CDN_URL || undefined,
  serverExternalPackages: [
    "@napi-rs/canvas",
    "otplib",
    "qrcode",
    "bcryptjs",
    "stripe",
    "nodemailer",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "mammoth",
    "pdf-parse",
    "xlsx",
    "officeparser",
    "ioredis",
    "bullmq",
    "@sentry/nextjs",
  ],
  reactCompiler: true,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "X-DNS-Prefetch-Control", value: "off" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=()",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Content-Security-Policy",
          value: cspValue,
        },
      ],
    },
  ],
};

// Wrap with Sentry only when DSN is configured
const finalConfig = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
      disableLogger: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    })
  : nextConfig;

export default finalConfig;
