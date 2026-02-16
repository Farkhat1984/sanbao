/**
 * k6 stress test: Find the breaking point
 *
 * Gradually increases load until the system fails.
 *
 * Usage:
 *   k6 run --env BASE_URL=https://sanbao.example.com tests/load/stress.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "2m", target: 100 },
    { duration: "3m", target: 500 },
    { duration: "3m", target: 1000 },
    { duration: "3m", target: 2000 },
    { duration: "3m", target: 5000 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.30"],               // fail if >30% errors
    http_req_duration: ["p(99)<10000"],  // 99th percentile under 10s
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3004";

export default function () {
  // Mix of endpoints to simulate real traffic

  // 60% — page loads (static + SSR)
  if (Math.random() < 0.6) {
    const res = http.get(`${BASE_URL}/login`);
    errorRate.add(res.status >= 500);
    check(res, { "page loads": (r) => r.status === 200 });
  }
  // 25% — API calls
  else if (Math.random() < 0.85) {
    const res = http.get(`${BASE_URL}/api/health`);
    errorRate.add(res.status >= 500);
    check(res, { "api responds": (r) => r.status < 500 });
  }
  // 15% — static assets
  else {
    const res = http.get(`${BASE_URL}/favicon.ico`);
    errorRate.add(res.status >= 500);
  }

  sleep(Math.random() * 2 + 0.5);
}
