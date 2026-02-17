#!/usr/bin/env node
/**
 * Test script for /api/chat — validates system prompt handles documents vs tools correctly.
 * Uses NextAuth's own encode() to create a valid session token.
 */

import { encode } from "next-auth/jwt";

const AUTH_SECRET = process.env.AUTH_SECRET || "DDYVaKEax0AYQ1IOmmi2KpJw3ItCouKkZFfKjW2DUp4=";
const BASE_URL = process.env.BASE_URL || "http://localhost:3004";
const ADMIN_USER_ID = "cmln2gum30000li01hzt4kcgy";
const COOKIE_NAME = "__Secure-authjs.session-token";

async function createToken() {
  return encode({
    token: {
      id: ADMIN_USER_ID,
      name: "Test Admin",
      email: "zfaragj@gmail.com",
      role: "ADMIN",
      twoFactorVerified: false,
      iat: Math.floor(Date.now() / 1000),
      sub: ADMIN_USER_ID,
    },
    secret: AUTH_SECRET,
    salt: COOKIE_NAME,
    maxAge: 3600,
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

const TESTS = [
  {
    name: "Таблица расходов",
    message: "Создай таблицу расходов за январь: категория, сумма, дата",
    expect: { hasSanbaoDoc: true, docType: "DOCUMENT", noCode: true, noRefusal: true },
  },
  {
    name: "Excel файл",
    message: "Сделай Excel файл с данными о продажах за 2025 год",
    expect: { hasSanbaoDoc: true, docType: "DOCUMENT", noCode: true, noRefusal: true },
  },
  {
    name: "Договор аренды",
    message: "Создай договор аренды квартиры в Алматы",
    expect: { hasSanbaoDoc: true, docType: "DOCUMENT", noCode: true, noRefusal: true },
  },
  {
    name: "Word документ",
    message: "Создай Word документ — коммерческое предложение для IT-компании",
    expect: { hasSanbaoDoc: true, docType: "DOCUMENT", noCode: true, noRefusal: true },
  },
  {
    name: "Бизнес-план",
    message: "Напиши бизнес-план для кофейни",
    expect: { hasSanbaoDoc: true, docType: "DOCUMENT", noCode: true, noRefusal: true },
  },
];

function checkResult(test, content) {
  const issues = [];
  const { expect: exp } = test;

  if (exp.hasSanbaoDoc && !content.includes("<sanbao-doc")) {
    issues.push("MISSING <sanbao-doc> — не создан артефакт документа");
  }

  if (exp.docType) {
    const m = content.match(/type="(\w+)"/);
    if (m && m[1] !== exp.docType) {
      issues.push(`WRONG type="${m[1]}" вместо "${exp.docType}"`);
    }
  }

  if (exp.noCode && content.includes('type="CODE"')) {
    issues.push('Использовал type="CODE" для текстового документа');
  }

  if (exp.noRefusal) {
    const refusals = [
      "не могу создать", "не могу сгенерировать", "не имею возможности",
      "к сожалению, я не", "не способен создать", "не могу создать файл",
      "не поддерживаю создание файлов",
    ];
    for (const r of refusals) {
      if (content.toLowerCase().includes(r)) {
        issues.push(`ОТКАЗ: «${r}»`);
        break;
      }
    }
  }

  if (exp.noCode) {
    const codePatterns = [
      [/import\s+React/, "import React"],
      [/export\s+default\s+function/, "export default function"],
      [/useState\(/, "useState()"],
      [/document\.getElementById/, "document.getElementById"],
    ];
    for (const [p, label] of codePatterns) {
      if (p.test(content) && !content.includes('type="CODE"')) {
        issues.push(`React/JS код в не-CODE документе: "${label}"`);
        break;
      }
    }
  }

  return issues;
}

async function main() {
  console.log("=== Sanbao Chat API — Тест документов vs инструментов ===\n");

  const token = await createToken();
  console.log(`Token: ${token.slice(0, 40)}...`);

  // Verify auth
  const sessRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: `${COOKIE_NAME}=${token}` },
  });
  const sessData = await sessRes.json().catch(() => null);
  if (sessData?.user?.email) {
    console.log(`Auth: ${sessData.user.email} (${sessData.user.role})\n`);
  } else {
    console.log("Auth FAILED\n");
    process.exit(1);
  }

  let passed = 0, failed = 0;

  for (const test of TESTS) {
    process.stdout.write(`[${test.name}] `);

    try {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: test.message }],
          thinkingEnabled: false,
          webSearchEnabled: false,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.log(`❌ HTTP ${res.status}: ${err.slice(0, 150)}`);
        failed++;
        continue;
      }

      const chunks = await parseStream(res);
      const content = getContent(chunks);
      const toolUses = chunks.filter(c => c.t === "s" && c.v === "using_tool").length;
      const issues = checkResult(test, content);

      if (issues.length === 0) {
        const m = content.match(/type="(\w+)"/);
        console.log(`✅ <sanbao-doc type="${m?.[1] || "?"}"> ${toolUses > 0 ? `(${toolUses} tool calls)` : ""}`);
        passed++;
      } else {
        console.log(`❌`);
        for (const issue of issues) console.log(`   → ${issue}`);
        // Show snippet
        const snippet = content.slice(0, 300).replace(/\n/g, "\\n");
        console.log(`   Preview: ${snippet}...`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Результат: ${passed}/${TESTS.length} ✅, ${failed} ❌ ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
