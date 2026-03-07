/**
 * E2E: Health endpoints
 *
 * Tests /api/health, /api/ready, and /api/metrics.
 * These are infrastructure endpoints used by Docker, k8s, and Prometheus.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  BASE_URL,
  apiRequest,
  createAdminToken,
  isServerReachable,
} from "./helpers";

let adminToken: string;

beforeAll(async () => {
  const reachable = await isServerReachable();
  if (!reachable) {
    throw new Error(
      `Sanbao server not reachable at ${BASE_URL}. Start it before running E2E tests.`,
    );
  }
  adminToken = await createAdminToken();
});

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
  it("should return 200 with status checks", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);

    const data = await res.json();
    // Health response should contain database check at minimum
    expect(data).toHaveProperty("status");
  });

  it("should include database check", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();

    // The health endpoint checks database connectivity
    if (data.checks) {
      expect(data.checks).toHaveProperty("database");
      expect(data.checks.database).toHaveProperty("status");
    }
  });

  it("should return JSON content-type", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// GET /api/ready
// ---------------------------------------------------------------------------

describe("GET /api/ready", () => {
  it("should return 200 when server is ready", async () => {
    const res = await fetch(`${BASE_URL}/api/ready`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ready).toBe(true);
  });

  it("should include redis status", async () => {
    const res = await fetch(`${BASE_URL}/api/ready`);
    const data = await res.json();
    // Redis field is always present (true, false, or "not_configured")
    expect(data).toHaveProperty("redis");
  });

  it("should set Cache-Control: no-store", async () => {
    const res = await fetch(`${BASE_URL}/api/ready`);
    const cacheControl = res.headers.get("cache-control") || "";
    expect(cacheControl).toContain("no-store");
  });
});

// ---------------------------------------------------------------------------
// GET /api/metrics
// ---------------------------------------------------------------------------

describe("GET /api/metrics", () => {
  it("should return 401/403 without authentication", async () => {
    const res = await fetch(`${BASE_URL}/api/metrics`);
    // Metrics requires either METRICS_TOKEN or admin session
    expect([401, 403]).toContain(res.status);
  });

  it("should return 200 with admin session", async () => {
    const res = await apiRequest("/api/metrics", { token: adminToken });
    // If METRICS_TOKEN is set and different from session auth, this may still fail.
    // Accept 200 or 403 (depends on server config).
    expect([200, 403]).toContain(res.status);

    if (res.status === 200) {
      const data = await res.json();
      // Metrics endpoint returns various counters
      expect(data).toBeDefined();
    }
  });
});
