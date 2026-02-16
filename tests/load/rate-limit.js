/**
 * k6 load test: Rate limit verification
 *
 * Verifies that rate limits work correctly under load.
 * Expects 429 responses after hitting the limit.
 *
 * Usage:
 *   k6 run --env BASE_URL=http://localhost:3004 tests/load/rate-limit.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";

const rateLimited = new Rate("rate_limited");
const totalRequests = new Counter("total_requests");

export const options = {
  scenarios: {
    // Burst: single user sending many requests fast
    burst: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 100,
      maxDuration: "30s",
    },
    // Sustained: many users at moderate rate
    sustained: {
      executor: "constant-arrival-rate",
      rate: 50,  // 50 RPS
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 20,
      maxVUs: 50,
      startTime: "35s",  // start after burst
    },
  },
  thresholds: {
    // At least some requests should be rate-limited
    rate_limited: ["rate>0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3004";

export default function () {
  totalRequests.add(1);

  const res = http.get(`${BASE_URL}/api/health`);

  const isLimited = res.status === 429;
  rateLimited.add(isLimited);

  check(res, {
    "response is 200 or 429": (r) => r.status === 200 || r.status === 429,
    "not a server error": (r) => r.status < 500,
  });

  // Very short sleep to stress rate limiter
  sleep(0.05);
}
