/**
 * k6 load test: Full chat flow
 *
 * Usage:
 *   k6 run --env BASE_URL=https://sanbao.example.com tests/load/chat-flow.js
 *   k6 run --env BASE_URL=http://localhost:3004 --vus 50 --duration 5m tests/load/chat-flow.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const chatLatency = new Trend("chat_first_byte_ms");
const chatErrors = new Rate("chat_errors");
const loginErrors = new Rate("login_errors");

// Configuration
export const options = {
  stages: [
    { duration: "1m", target: 50 },    // ramp up to 50 users
    { duration: "3m", target: 200 },   // ramp up to 200 users
    { duration: "5m", target: 200 },   // hold 200 users
    { duration: "2m", target: 500 },   // ramp up to 500 users
    { duration: "3m", target: 500 },   // hold 500 users
    { duration: "1m", target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000"],  // 95% of requests under 3s
    chat_first_byte_ms: ["p(95)<5000"], // first byte of chat stream under 5s
    chat_errors: ["rate<0.05"],         // chat error rate under 5%
    login_errors: ["rate<0.01"],        // login error rate under 1%
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3004";
const TEST_EMAIL = __ENV.TEST_EMAIL || `loadtest+${__VU}@example.com`;
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "LoadTest123!";

// ─── Register (once per VU) ─────────────────────────────

export function setup() {
  // Create a test user for load testing
  const res = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email: "loadtest-setup@example.com",
      password: TEST_PASSWORD,
      name: "Load Test",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
  return { baseUrl: BASE_URL };
}

// ─── Main scenario ──────────────────────────────────────

export default function (data) {
  const baseUrl = data.baseUrl;
  let authToken = null;

  // 1. Login
  group("Login", () => {
    const email = `loadtest+vu${__VU}@example.com`;

    // Register (ignore errors — user may already exist)
    http.post(
      `${baseUrl}/api/auth/register`,
      JSON.stringify({ email, password: TEST_PASSWORD, name: `VU ${__VU}` }),
      { headers: { "Content-Type": "application/json" } }
    );

    // Login via NextAuth credentials
    const loginRes = http.post(
      `${baseUrl}/api/auth/callback/credentials`,
      JSON.stringify({ email, password: TEST_PASSWORD }),
      {
        headers: { "Content-Type": "application/json" },
        redirects: 0,
      }
    );

    const success = loginRes.status === 200 || loginRes.status === 302;
    loginErrors.add(!success);
    check(loginRes, { "login successful": () => success });

    // Extract session cookie
    if (loginRes.cookies && loginRes.cookies["next-auth.session-token"]) {
      authToken = loginRes.cookies["next-auth.session-token"][0].value;
    }
  });

  sleep(1);

  // 2. Health check
  group("Health Check", () => {
    const res = http.get(`${baseUrl}/api/health`);
    check(res, {
      "health is 200": (r) => r.status === 200,
      "health reports healthy": (r) => {
        try { return JSON.parse(r.body).status === "healthy"; } catch { return false; }
      },
    });
  });

  sleep(0.5);

  // 3. Create conversation
  let conversationId = null;
  group("Create Conversation", () => {
    const res = http.post(
      `${baseUrl}/api/conversations`,
      JSON.stringify({ title: `Load test ${Date.now()}` }),
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `next-auth.session-token=${authToken}`,
        },
      }
    );

    check(res, { "conversation created": (r) => r.status === 200 || r.status === 201 });

    try {
      conversationId = JSON.parse(res.body).id;
    } catch {
      // ignore
    }
  });

  sleep(0.5);

  // 4. Send chat message (SSE stream)
  group("Chat Message", () => {
    const startTime = Date.now();

    const res = http.post(
      `${baseUrl}/api/chat`,
      JSON.stringify({
        messages: [{ role: "user", content: "Привет! Как дела?" }],
        conversationId,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `next-auth.session-token=${authToken}`,
        },
        timeout: "30s",
      }
    );

    const firstByteMs = Date.now() - startTime;
    chatLatency.add(firstByteMs);

    const success = res.status === 200;
    chatErrors.add(!success);
    check(res, {
      "chat returns 200": (r) => r.status === 200,
      "chat has body": (r) => r.body && r.body.length > 0,
    });
  });

  sleep(2);

  // 5. Load sidebar (conversation list)
  group("List Conversations", () => {
    const res = http.get(`${baseUrl}/api/conversations?limit=20`, {
      headers: { Cookie: `next-auth.session-token=${authToken}` },
    });
    check(res, { "conversations listed": (r) => r.status === 200 });
  });

  sleep(1);
}
