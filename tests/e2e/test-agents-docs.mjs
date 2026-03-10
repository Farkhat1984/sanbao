#!/usr/bin/env node
/**
 * Test: document creation works with ALL agents (system + custom).
 * Sends "создай таблицу расходов" to each agent — expects <sanbao-doc type="DOCUMENT">.
 */

import { encode } from "next-auth/jwt";

const AUTH_SECRET = "DDYVaKEax0AYQ1IOmmi2KpJw3ItCouKkZFfKjW2DUp4=";
const BASE_URL = "http://localhost:3004";
const ADMIN_USER_ID = "cmln2gum30000li01hzt4kcgy";
const COOKIE_NAME = "__Secure-authjs.session-token";

const AGENTS = [
  { id: null, name: "(без агента)" },
  { id: "system-sanbao-agent", name: "Sanbao" },
  { id: "system-femida-agent", name: "Юрист" },
  { id: "system-broker-agent", name: "Таможенный брокер" },
  { id: "system-accountant-agent", name: "Бухгалтер" },
  { id: "system-1c-assistant-agent", name: "1С Ассистент" },
];

const TEST_MESSAGE = "Создай таблицу ежемесячных расходов компании за I квартал с колонками: месяц, аренда, зарплата, коммуналка, итого";

async function createToken() {
  return encode({
    token: {
      id: ADMIN_USER_ID, name: "Test", email: "zfaragj@gmail.com",
      role: "ADMIN", twoFactorVerified: false,
      iat: Math.floor(Date.now() / 1000), sub: ADMIN_USER_ID,
    },
    secret: AUTH_SECRET, salt: COOKIE_NAME, maxAge: 3600,
  });
}

async function parseStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try { chunks.push(JSON.parse(line)); } catch {}
    }
  }
  return chunks;
}

function getContent(chunks) {
  return chunks.filter(c => c.t === "c").map(c => c.v).join("");
}

function check(content) {
  const issues = [];
  if (!content.includes("<sanbao-doc")) issues.push("NO <sanbao-doc>");
  const m = content.match(/type="(\w+)"/);
  if (m && m[1] !== "DOCUMENT") issues.push(`type="${m[1]}" (not DOCUMENT)`);
  if (content.includes('type="CODE"')) issues.push('type="CODE" — wrong');
  const refusals = ["не могу создать", "не могу сгенерировать", "не поддерживаю"];
  for (const r of refusals) {
    if (content.toLowerCase().includes(r)) { issues.push(`ОТКАЗ: «${r}»`); break; }
  }
  return issues;
}

async function main() {
  console.log("=== Тест документов для ВСЕХ агентов ===\n");
  console.log(`Запрос: "${TEST_MESSAGE}"\n`);

  const token = await createToken();
  let passed = 0, failed = 0;

  for (const agent of AGENTS) {
    process.stdout.write(`[${agent.name.padEnd(22)}] `);
    try {
      const body = {
        messages: [{ role: "user", content: TEST_MESSAGE }],
        thinkingEnabled: false,
        webSearchEnabled: false,
      };
      if (agent.id) body.agentId = agent.id;

      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        console.log(`❌ HTTP ${res.status}: ${err.slice(0, 100)}`);
        failed++;
        continue;
      }

      const chunks = await parseStream(res);
      const content = getContent(chunks);
      const toolUses = chunks.filter(c => c.t === "s" && c.v === "using_tool").length;
      const issues = check(content);

      if (issues.length === 0) {
        const m = content.match(/type="(\w+)"/);
        const hasTable = content.includes("|") && content.includes("---");
        console.log(`✅ type="${m?.[1]}" ${hasTable ? "📊 таблица" : ""} ${toolUses ? `🔧 ${toolUses} tools` : ""}`);
        passed++;
      } else {
        console.log(`❌ ${issues.join(", ")}`);
        console.log(`   → ${content.slice(0, 200).replace(/\n/g, "\\n")}...`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Результат: ${passed}/${AGENTS.length} ✅, ${failed} ❌ ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
