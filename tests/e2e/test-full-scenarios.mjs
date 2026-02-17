#!/usr/bin/env node
/**
 * Full scenario test suite for /api/chat
 * Tests: attachments, thinking mode, web search, combined modes, limits
 *
 * Kimi K2.5 specs: 256K context, text+image input, OpenAI multimodal format
 * Sanbao limits: 20 attachments, 20MB/file, 200 messages, 100KB/message
 */

import { encode } from "next-auth/jwt";

const AUTH_SECRET = "DDYVaKEax0AYQ1IOmmi2KpJw3ItCouKkZFfKjW2DUp4=";
const BASE_URL = "http://localhost:3004";
const COOKIE_NAME = "__Secure-authjs.session-token";
const ADMIN_USER_ID = "cmln2gum30000li01hzt4kcgy";

let TOKEN = "";
let passed = 0, failed = 0, skipped = 0;
const results = [];

// ─── Auth ────────────────────────────────────────────────
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

// ─── Stream parsing ──────────────────────────────────────
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

function getContent(chunks) { return chunks.filter(c => c.t === "c").map(c => c.v).join(""); }
function getReasoning(chunks) { return chunks.filter(c => c.t === "r").map(c => c.v).join(""); }
function getStatuses(chunks) { return chunks.filter(c => c.t === "s").map(c => c.v); }
function getErrors(chunks) { return chunks.filter(c => c.t === "e").map(c => c.v); }
function getContextInfo(chunks) {
  const x = chunks.find(c => c.t === "x");
  if (!x) return null;
  try { return JSON.parse(x.v); } catch { return null; }
}

// ─── Helpers ─────────────────────────────────────────────
// Create a small 1x1 red PNG in base64 for image attachment tests
const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

function makeTextAttachment(name, content) {
  return { name, type: "text/plain", textContent: content };
}

function makeImageAttachment(name) {
  return { name, type: "image/png", base64: TINY_PNG_BASE64 };
}

function makeCsvAttachment(name, csvContent) {
  return { name, type: "text/csv", textContent: csvContent };
}

// ─── API call ────────────────────────────────────────────
async function chatRequest(body) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${COOKIE_NAME}=${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  return res;
}

// ─── Test runner ─────────────────────────────────────────
async function runTest(name, body, checks) {
  process.stdout.write(`  [${name}] `);
  const startTime = Date.now();

  try {
    const res = await chatRequest(body);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!res.ok) {
      const errText = await res.text();
      const errObj = JSON.parse(errText).error || errText.slice(0, 150);

      // Some tests expect errors
      if (checks.expectError) {
        if (res.status === checks.expectError) {
          console.log(`✅ HTTP ${res.status} (expected) [${elapsed}s]`);
          passed++;
          results.push({ name, status: "pass", time: elapsed });
          return;
        }
      }

      console.log(`❌ HTTP ${res.status}: ${errObj} [${elapsed}s]`);
      failed++;
      results.push({ name, status: "fail", error: `HTTP ${res.status}` });
      return;
    }

    if (checks.expectError) {
      console.log(`❌ Expected HTTP ${checks.expectError} but got 200 [${elapsed}s]`);
      failed++;
      results.push({ name, status: "fail", error: "Expected error" });
      return;
    }

    const chunks = await parseStream(res);
    const content = getContent(chunks);
    const reasoning = getReasoning(chunks);
    const statuses = getStatuses(chunks);
    const errors = getErrors(chunks);
    const ctx = getContextInfo(chunks);
    const issues = [];

    // Check for stream errors
    if (errors.length > 0) {
      issues.push(`Stream error: ${errors[0]}`);
    }

    // Check document creation
    if (checks.hasSanbaoDoc !== undefined) {
      const hasDoc = content.includes("<sanbao-doc");
      if (checks.hasSanbaoDoc && !hasDoc) issues.push("MISSING <sanbao-doc>");
      if (!checks.hasSanbaoDoc && hasDoc) issues.push("UNEXPECTED <sanbao-doc>");
    }

    // Check doc type
    if (checks.docType) {
      const m = content.match(/type="(\w+)"/);
      if (!m) issues.push(`No type= found (expected ${checks.docType})`);
      else if (m[1] !== checks.docType) issues.push(`type="${m[1]}" ≠ "${checks.docType}"`);
    }

    // Check no CODE type for documents
    if (checks.noCodeType && content.includes('type="CODE"')) {
      issues.push('Wrong: type="CODE" for text document');
    }

    // Check no refusal
    if (checks.noRefusal) {
      const refusals = ["не могу создать", "не могу сгенерировать", "не имею возможности",
        "к сожалению, я не", "не способен создать", "не поддерживаю"];
      for (const r of refusals) {
        if (content.toLowerCase().includes(r)) { issues.push(`Refusal: «${r}»`); break; }
      }
    }

    // Check reasoning present
    if (checks.hasReasoning && !reasoning) {
      issues.push("No reasoning content (thinking mode)");
    }

    // Check search status
    if (checks.hasSearchStatus) {
      if (!statuses.includes("searching") && !statuses.includes("using_tool")) {
        issues.push("No search/tool status in stream");
      }
    }

    // Check tool usage
    if (checks.hasToolUsage && !statuses.includes("using_tool")) {
      issues.push("No using_tool status");
    }

    // Check has markdown table
    if (checks.hasTable) {
      if (!content.includes("|") || !content.includes("---")) {
        issues.push("No markdown table found");
      }
    }

    // Check content contains keyword
    if (checks.contentContains) {
      for (const kw of checks.contentContains) {
        if (!content.toLowerCase().includes(kw.toLowerCase())) {
          issues.push(`Missing keyword: "${kw}"`);
        }
      }
    }

    // Check file reference in content (model should acknowledge file)
    if (checks.mentionsFile) {
      const mentionsAny = checks.mentionsFile.some(f =>
        content.toLowerCase().includes(f.toLowerCase())
      );
      if (!mentionsAny) {
        issues.push(`Model didn't reference attached file(s): ${checks.mentionsFile.join(", ")}`);
      }
    }

    // Check context info
    if (checks.hasContextInfo && !ctx) {
      issues.push("No context_info in stream");
    }

    if (issues.length === 0) {
      const tags = [];
      if (content.includes("<sanbao-doc")) {
        const m = content.match(/type="(\w+)"/);
        tags.push(`doc:${m?.[1] || "?"}`);
      }
      if (reasoning) tags.push(`reasoning:${reasoning.length}ch`);
      if (statuses.includes("searching")) tags.push("🔍search");
      if (statuses.includes("using_tool")) tags.push("🔧tool");
      if (content.includes("|") && content.includes("---")) tags.push("📊table");

      console.log(`✅ ${tags.join(" ")} [${elapsed}s]`);
      passed++;
      results.push({ name, status: "pass", time: elapsed });
    } else {
      console.log(`❌ [${elapsed}s]`);
      for (const issue of issues) console.log(`     → ${issue}`);
      const preview = content.slice(0, 250).replace(/\n/g, "\\n");
      console.log(`     Preview: ${preview}...`);
      failed++;
      results.push({ name, status: "fail", issues });
    }
  } catch (err) {
    console.log(`❌ ${err.message}`);
    failed++;
    results.push({ name, status: "fail", error: err.message });
  }
}

// ═══════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║  Sanbao Full Scenario Test Suite                     ║");
  console.log("║  Kimi K2.5 · 256K context · Attachments · Modes     ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");

  TOKEN = await createToken();

  // Verify auth
  const sess = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Cookie: `${COOKIE_NAME}=${TOKEN}` },
  }).then(r => r.json()).catch(() => null);

  if (!sess?.user) { console.log("❌ Auth failed"); process.exit(1); }
  console.log(`Auth: ${sess.user.email} (${sess.user.role})\n`);

  // ─── 1. DOCUMENT CREATION WITH TEXT ATTACHMENTS ────────
  console.log("━━━ 1. Документы с текстовыми вложениями ━━━");

  await runTest("TXT файл → анализ + документ", {
    messages: [{ role: "user", content: "Проанализируй данные из файла и создай сводный отчёт" }],
    thinkingEnabled: false, webSearchEnabled: false,
    attachments: [makeTextAttachment("sales.txt",
      "Январь: продажи 1.5 млн, расходы 800 тыс\nФевраль: продажи 2.1 млн, расходы 900 тыс\nМарт: продажи 1.8 млн, расходы 750 тыс")],
  }, { hasSanbaoDoc: true, noCodeType: true, noRefusal: true });

  await runTest("CSV файл → таблица в DOCUMENT", {
    messages: [{ role: "user", content: "Создай красивую таблицу на основе CSV данных" }],
    thinkingEnabled: false, webSearchEnabled: false,
    attachments: [makeCsvAttachment("data.csv",
      "Категория,Январь,Февраль,Март\nАренда,500000,500000,500000\nЗарплата,1200000,1200000,1300000\nКоммуналка,80000,75000,90000")],
  }, { hasSanbaoDoc: true, docType: "DOCUMENT", noCodeType: true, hasTable: true, noRefusal: true });

  await runTest("Несколько файлов одновременно", {
    messages: [{ role: "user", content: "Объедини данные из обоих файлов в единый отчёт" }],
    thinkingEnabled: false, webSearchEnabled: false,
    attachments: [
      makeTextAttachment("plan.txt", "План: увеличить продажи на 20% к Q3"),
      makeCsvAttachment("actual.csv", "Квартал,План,Факт\nQ1,3000000,2800000\nQ2,3500000,3200000"),
    ],
  }, { hasSanbaoDoc: true, noCodeType: true, noRefusal: true });

  // ─── 2. IMAGE ATTACHMENTS ─────────────────────────────
  console.log("\n━━━ 2. Изображения ━━━");

  await runTest("Одно изображение + запрос описания", {
    messages: [{ role: "user", content: "Кратко опиши что ты видишь на этом изображении, в 1-2 предложения" }],
    thinkingEnabled: false, webSearchEnabled: false,
    attachments: [makeImageAttachment("photo.png")],
  }, { noRefusal: true });

  await runTest("Изображение + текст файл + документ", {
    messages: [{ role: "user", content: "На основе данных из файла создай отчёт о состоянии проекта. Изображение прикреплено для контекста" }],
    thinkingEnabled: false, webSearchEnabled: false,
    attachments: [
      makeImageAttachment("screenshot.png"),
      makeTextAttachment("notes.txt", "Проект: Редизайн главной страницы\nСтатус: 70% завершено\nДедлайн: 15 марта"),
    ],
  }, { hasSanbaoDoc: true, noCodeType: true, noRefusal: true });

  // ─── 3. THINKING MODE (REASONING) ─────────────────────
  console.log("\n━━━ 3. Режим мышления (reasoning) ━━━");

  await runTest("Thinking + создание документа", {
    messages: [{ role: "user", content: "Создай подробный SWOT-анализ для открытия ресторана в Алматы" }],
    thinkingEnabled: true, webSearchEnabled: false,
  }, { hasSanbaoDoc: true, noCodeType: true, noRefusal: true, hasReasoning: true });

  await runTest("Thinking + вложение + документ", {
    messages: [{ role: "user", content: "Проанализируй финансовые данные и создай аналитический отчёт с выводами" }],
    thinkingEnabled: true, webSearchEnabled: false,
    attachments: [makeCsvAttachment("finance.csv",
      "Месяц,Доход,Расход,Прибыль\nЯнварь,5000000,3500000,1500000\nФевраль,5500000,3800000,1700000\nМарт,4800000,3600000,1200000")],
  }, { hasSanbaoDoc: true, noCodeType: true, noRefusal: true, hasReasoning: true });

  // ─── 4. WEB SEARCH MODE ───────────────────────────────
  console.log("\n━━━ 4. Веб-поиск ━━━");

  await runTest("Поиск + создание документа", {
    messages: [{ role: "user", content: "Найди актуальный курс тенге к доллару и создай справку о текущих валютных курсах" }],
    thinkingEnabled: false, webSearchEnabled: true,
  }, { hasSanbaoDoc: true, noCodeType: true, noRefusal: true, hasSearchStatus: true });

  await runTest("Поиск + короткий ответ (без документа)", {
    messages: [{ role: "user", content: "Какая погода сейчас в Астане?" }],
    thinkingEnabled: false, webSearchEnabled: true,
  }, { noRefusal: true, hasSearchStatus: true });

  // ─── 5. COMBINED MODES ────────────────────────────────
  console.log("\n━━━ 5. Комбинированные режимы ━━━");

  await runTest("Thinking + Search + документ", {
    messages: [{ role: "user", content: "Найди последние изменения в налоговом кодексе РК и создай аналитическую записку" }],
    thinkingEnabled: true, webSearchEnabled: true,
  }, { hasSanbaoDoc: true, noCodeType: true, noRefusal: true });

  await runTest("Thinking + Search + вложение", {
    messages: [{ role: "user", content: "Проанализируй данные из файла, найди актуальные рыночные цены и создай ценовой отчёт" }],
    thinkingEnabled: true, webSearchEnabled: true,
    attachments: [makeCsvAttachment("prices.csv",
      "Товар,Наша цена,Конкурент\nНоутбук,350000,380000\nМонитор,120000,115000\nКлавиатура,15000,18000")],
  }, { hasSanbaoDoc: true, noCodeType: true, noRefusal: true });

  // ─── 6. EDGE CASES & LIMITS ───────────────────────────
  console.log("\n━━━ 6. Граничные случаи и лимиты ━━━");

  // Max attachments (20)
  const manyAttachments = Array.from({ length: 20 }, (_, i) =>
    makeTextAttachment(`file${i + 1}.txt`, `Данные файла ${i + 1}: значение ${Math.random().toFixed(2)}`)
  );
  await runTest("20 вложений (максимум)", {
    messages: [{ role: "user", content: "Объедини данные из всех файлов в сводную таблицу" }],
    thinkingEnabled: false, webSearchEnabled: false,
    attachments: manyAttachments,
  }, { hasSanbaoDoc: true, noCodeType: true, noRefusal: true });

  // Over limit (21 attachments)
  const tooManyAttachments = Array.from({ length: 21 }, (_, i) =>
    makeTextAttachment(`file${i + 1}.txt`, `data ${i}`)
  );
  await runTest("21 вложение (превышение лимита)", {
    messages: [{ role: "user", content: "test" }],
    thinkingEnabled: false, webSearchEnabled: false,
    attachments: tooManyAttachments,
  }, { expectError: 400 });

  // Large text attachment (close to 100KB message limit)
  const largeText = "А".repeat(80000); // ~80KB of text
  await runTest("Большое текстовое вложение (~80KB)", {
    messages: [{ role: "user", content: "Создай краткое резюме этого текста" }],
    thinkingEnabled: false, webSearchEnabled: false,
    attachments: [makeTextAttachment("large.txt", largeText)],
  }, { noRefusal: true });

  // Empty message (only attachment)
  await runTest("Только вложение без текста", {
    messages: [{ role: "user", content: "" }],
    thinkingEnabled: false, webSearchEnabled: false,
    attachments: [makeCsvAttachment("report.csv", "A,B,C\n1,2,3\n4,5,6")],
  }, { noRefusal: true });

  // ─── 7. DOCUMENT TYPES EDGE CASES ─────────────────────
  console.log("\n━━━ 7. Типы документов — граничные случаи ━━━");

  await runTest("'Сделай PDF' → DOCUMENT (не отказ)", {
    messages: [{ role: "user", content: "Сделай PDF документ — список сотрудников компании" }],
    thinkingEnabled: false, webSearchEnabled: false,
  }, { hasSanbaoDoc: true, docType: "DOCUMENT", noCodeType: true, noRefusal: true });

  await runTest("'Создай файл Excel' → DOCUMENT", {
    messages: [{ role: "user", content: "Создай файл Excel с расписанием работы на неделю" }],
    thinkingEnabled: false, webSearchEnabled: false,
  }, { hasSanbaoDoc: true, docType: "DOCUMENT", noCodeType: true, noRefusal: true, hasTable: true });

  await runTest("Интерактивный калькулятор → CODE (не DOCUMENT)", {
    messages: [{ role: "user", content: "Сделай интерактивный калькулятор кредита с полями ввода" }],
    thinkingEnabled: false, webSearchEnabled: false,
  }, { hasSanbaoDoc: true, docType: "CODE", noRefusal: true });

  await runTest("Правовой анализ → ANALYSIS", {
    messages: [{ role: "user", content: "Проведи правовой анализ статьи 188 УК РК" }],
    thinkingEnabled: false, webSearchEnabled: false,
  }, { hasSanbaoDoc: true, docType: "ANALYSIS", noRefusal: true });

  // ─── 8. NATIVE TOOLS + DOCUMENTS ──────────────────────
  console.log("\n━━━ 8. Нативные инструменты + документы ━━━");

  await runTest("calculate → result in text (no doc)", {
    messages: [{ role: "user", content: "Сколько будет 15% от 3 миллионов?" }],
    thinkingEnabled: false, webSearchEnabled: false,
  }, { hasSanbaoDoc: false, noRefusal: true });

  await runTest("Запомни + без документа", {
    messages: [{ role: "user", content: "Запомни что мой любимый цвет — синий" }],
    thinkingEnabled: false, webSearchEnabled: false,
  }, { hasSanbaoDoc: false, noRefusal: true });

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log(`║  ИТОГО: ${passed} ✅  ${failed} ❌  ${skipped} ⏭️   из ${passed + failed + skipped} тестов`);
  console.log("╚═══════════════════════════════════════════════════════╝");

  if (failed > 0) {
    console.log("\nНеуспешные тесты:");
    for (const r of results.filter(r => r.status === "fail")) {
      console.log(`  ❌ ${r.name}: ${r.error || r.issues?.join(", ")}`);
    }
  }

  // Timing
  const times = results.filter(r => r.time).map(r => parseFloat(r.time));
  if (times.length > 0) {
    const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1);
    const max = Math.max(...times).toFixed(1);
    const total = times.reduce((a, b) => a + b, 0).toFixed(0);
    console.log(`\nTiming: avg ${avg}s, max ${max}s, total ${total}s`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
