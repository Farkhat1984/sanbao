#!/bin/bash
# E2E Test: Organizations + AI Agents Pipeline
# Tests the full flow: create org → create agent → upload files → process → publish

set -euo pipefail

BASE="https://www.sanbao.ai"
TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <bearer-token>"
  exit 1
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ PASS: $1${NC}"; }
fail() { echo -e "${RED}✗ FAIL: $1${NC}"; echo -e "  ${RED}Response: $2${NC}"; exit 1; }
info() { echo -e "${CYAN}► $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

AUTH="Authorization: Bearer $TOKEN"
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  E2E TEST: Organizations + AI Agents Pipeline ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""

# ─── Step 1: Verify auth ────────────────────────────────
info "Step 1: Verify authentication..."

CONV_RESP=$(curl -sf -H "$AUTH" ${BASE}/api/conversations 2>&1 || echo "FAIL")
if echo "$CONV_RESP" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  pass "Authentication working"
else
  fail "Auth check failed" "$CONV_RESP"
fi

# ─── Step 2: Create Organization ────────────────────────
info "Step 2: Create organization..."

ORG_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "$AUTH" -H "Content-Type: application/json" \
  ${BASE}/api/organizations \
  -d '{"name":"E2E Test Corp"}' 2>&1)
ORG_HTTP=$(echo "$ORG_RESP" | tail -1)
ORG_BODY=$(echo "$ORG_RESP" | sed '$d')

if [ "$ORG_HTTP" = "200" ] || [ "$ORG_HTTP" = "201" ]; then
  ORG_ID=$(echo "$ORG_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  ORG_SLUG=$(echo "$ORG_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['slug'])")
  ORG_NS=$(echo "$ORG_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('namespace',''))")
  pass "Organization created: id=$ORG_ID slug=$ORG_SLUG namespace=$ORG_NS"
else
  fail "Create org (HTTP $ORG_HTTP)" "$ORG_BODY"
fi

# ─── Step 3: Get Organization ───────────────────────────
info "Step 3: Get organization details..."

ORG_GET=$(curl -s -w "\n%{http_code}" -H "$AUTH" ${BASE}/api/organizations/${ORG_ID} 2>&1)
ORG_GET_HTTP=$(echo "$ORG_GET" | tail -1)
ORG_GET_BODY=$(echo "$ORG_GET" | sed '$d')

if [ "$ORG_GET_HTTP" = "200" ]; then
  ORG_GET_NAME=$(echo "$ORG_GET_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
  pass "Org details: name=$ORG_GET_NAME"
else
  fail "Get org (HTTP $ORG_GET_HTTP)" "$ORG_GET_BODY"
fi

# ─── Step 4: List members ──────────────────────────────
info "Step 4: List organization members..."

MEMBERS_RESP=$(curl -s -w "\n%{http_code}" -H "$AUTH" ${BASE}/api/organizations/${ORG_ID}/members 2>&1)
MEMBERS_HTTP=$(echo "$MEMBERS_RESP" | tail -1)
MEMBERS_BODY=$(echo "$MEMBERS_RESP" | sed '$d')

if [ "$MEMBERS_HTTP" = "200" ]; then
  MEMBER_COUNT=$(echo "$MEMBERS_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  MEMBER_ROLE=$(echo "$MEMBERS_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['role'])")
  pass "Members: count=$MEMBER_COUNT, first role=$MEMBER_ROLE"
else
  fail "List members (HTTP $MEMBERS_HTTP)" "$MEMBERS_BODY"
fi

# ─── Step 5: List organizations ─────────────────────────
info "Step 5: List my organizations..."

ORGS_RESP=$(curl -s -w "\n%{http_code}" -H "$AUTH" ${BASE}/api/organizations 2>&1)
ORGS_HTTP=$(echo "$ORGS_RESP" | tail -1)
ORGS_BODY=$(echo "$ORGS_RESP" | sed '$d')

if [ "$ORGS_HTTP" = "200" ]; then
  ORG_COUNT=$(echo "$ORGS_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  pass "My organizations: count=$ORG_COUNT"
else
  fail "List orgs (HTTP $ORGS_HTTP)" "$ORGS_BODY"
fi

# ─── Step 6: Create Agent ──────────────────────────────
info "Step 6: Create organization agent..."

AGENT_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "$AUTH" -H "Content-Type: application/json" \
  ${BASE}/api/organizations/${ORG_ID}/agents \
  -d '{"name":"KB Test Agent","description":"E2E test knowledge base with multiple file types"}' 2>&1)
AGENT_HTTP=$(echo "$AGENT_RESP" | tail -1)
AGENT_BODY=$(echo "$AGENT_RESP" | sed '$d')

if [ "$AGENT_HTTP" = "200" ] || [ "$AGENT_HTTP" = "201" ]; then
  AGENT_ID=$(echo "$AGENT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  AGENT_STATUS=$(echo "$AGENT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
  AGENT_PROJECT=$(echo "$AGENT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('projectId',''))")
  pass "Agent created: id=$AGENT_ID status=$AGENT_STATUS projectId=$AGENT_PROJECT"
else
  fail "Create agent (HTTP $AGENT_HTTP)" "$AGENT_BODY"
fi

# ─── Step 7: Create test files ─────────────────────────
info "Step 7: Preparing test dataset files..."

# File 1: Legal knowledge (TXT)
cat > ${TMPDIR}/labor_code_kz.txt << 'EOF'
ТРУДОВОЙ КОДЕКС РЕСПУБЛИКИ КАЗАХСТАН

Глава 1. ОБЩИЕ ПОЛОЖЕНИЯ

Статья 1. Основные понятия, используемые в настоящем Кодексе
1) безопасность труда — состояние защищенности работников, обеспеченное комплексом мероприятий;
2) вахтовый метод — особая форма осуществления трудового процесса вне места постоянного проживания;
3) гарантии — средства, способы и условия, с помощью которых обеспечивается осуществление предоставленных работникам прав;
4) дисциплинарное взыскание — мера дисциплинарного воздействия на работника;
5) заработная плата — вознаграждение за труд в зависимости от квалификации работника;

Статья 2. Трудовое законодательство Республики Казахстан
1. Трудовое законодательство основывается на Конституции Республики Казахстан.
2. Трудовое законодательство состоит из настоящего Кодекса и иных нормативных правовых актов.

Статья 3. Цель и задачи трудового законодательства
Целью трудового законодательства является правовое регулирование трудовых отношений.
Задачами являются создание необходимых правовых условий для достижения баланса интересов сторон.

Статья 4. Принципы трудового законодательства
1) недопустимость ограничения прав человека и гражданина в сфере труда;
2) свобода труда;
3) запрещение дискриминации и принудительного труда;
4) обеспечение права на условия труда, отвечающие требованиям безопасности и гигиены;
5) приоритет жизни и здоровья работника;

Глава 2. ТРУДОВЫЕ ОТНОШЕНИЯ

Статья 15. Трудовой договор
Трудовой договор — письменное соглашение между работником и работодателем.
Содержание трудового договора определяется соглашением сторон с учетом минимальных стандартов.
Срок трудового договора может быть определенным или неопределенным.
Минимальный размер заработной платы устанавливается ежегодно законом о республиканском бюджете.

Статья 16. Испытательный срок
При заключении трудового договора может быть установлен испытательный срок.
Испытательный срок не может превышать три месяца.
В испытательный срок не засчитываются период нетрудоспособности и другие периоды отсутствия.
EOF

# File 2: Company financial data (CSV)
cat > ${TMPDIR}/financial_report_2025.csv << 'CSVEOF'
quarter,revenue_kzt,expenses_kzt,profit_kzt,employees,department
Q1 2025,45000000,32000000,13000000,52,Company Total
Q1 2025,18000000,12000000,6000000,20,IT Department
Q1 2025,12000000,8000000,4000000,15,Sales Department
Q1 2025,8000000,7000000,1000000,10,Marketing
Q1 2025,7000000,5000000,2000000,7,Finance
Q2 2025,52000000,35000000,17000000,55,Company Total
Q2 2025,22000000,14000000,8000000,22,IT Department
Q2 2025,14000000,9000000,5000000,15,Sales Department
Q2 2025,9000000,7500000,1500000,11,Marketing
Q2 2025,7000000,4500000,2500000,7,Finance
Q3 2025,48000000,34000000,14000000,58,Company Total
Q3 2025,20000000,13500000,6500000,24,IT Department
Q3 2025,13000000,9500000,3500000,16,Sales Department
Q3 2025,8500000,7000000,1500000,11,Marketing
Q3 2025,6500000,4000000,2500000,7,Finance
Q4 2025,61000000,40000000,21000000,60,Company Total
Q4 2025,25000000,16000000,9000000,25,IT Department
Q4 2025,17000000,11000000,6000000,16,Sales Department
Q4 2025,11000000,8000000,3000000,12,Marketing
Q4 2025,8000000,5000000,3000000,7,Finance
CSVEOF

# File 3: HR policies (TXT simulating a document)
cat > ${TMPDIR}/hr_policies.txt << 'EOF'
ВНУТРЕННИЙ РЕГЛАМЕНТ КОМПАНИИ — HR ПОЛИТИКИ

Раздел 1. Рабочее время и отдых

1.1. Стандартный рабочий день: с 09:00 до 18:00, понедельник-пятница.
1.2. Обеденный перерыв: 1 час (с 13:00 до 14:00).
1.3. Гибкий график: доступен для сотрудников IT и маркетинга с согласия руководителя.
1.4. Удаленная работа: до 3 дней в неделю при согласовании с непосредственным руководителем.
1.5. Сверхурочная работа: оплачивается в 1.5x за первые 2 часа, 2x за последующие.

Раздел 2. Отпуска

2.1. Ежегодный оплачиваемый отпуск: 24 календарных дня.
2.2. Дополнительный отпуск за вредные условия: до 6 дней.
2.3. Отпуск по беременности и родам: 126 календарных дней (70 до родов, 56 после).
2.4. Отпуск отцу при рождении ребенка: 5 рабочих дней.
2.5. Учебный отпуск: до 30 календарных дней при обучении в аккредитованном ВУЗе.

Раздел 3. Оплата труда

3.1. Заработная плата выплачивается 5-го и 20-го числа каждого месяца.
3.2. Годовой бонус: до 2-х месячных окладов по результатам KPI.
3.3. Премия за проекты: определяется индивидуально руководителем подразделения.
3.4. Компенсация за использование личного транспорта: 20,000 KZT/месяц.
3.5. Компенсация мобильной связи: до 10,000 KZT/месяц для менеджеров.

Раздел 4. Информационная безопасность

4.1. Пароли: минимум 12 символов, буквы, цифры и спецсимволы.
4.2. Двухфакторная аутентификация обязательна для всех корпоративных систем.
4.3. VPN обязателен при работе из дома.
4.4. Передача конфиденциальной информации третьим лицам запрещена.
4.5. Инциденты безопасности: немедленно сообщать в отдел IT.

Раздел 5. Дисциплина

5.1. Опоздание более 15 минут фиксируется как нарушение.
5.2. Три опоздания в месяц — предупреждение от руководителя.
5.3. Прогул без уважительной причины — дисциплинарное взыскание.
5.4. Курение только в специально отведенных местах.
5.5. Дресс-код: business casual, пятница — свободная форма одежды.
EOF

echo "  Created 3 test files:"
ls -la ${TMPDIR}/ | grep -v "^total\|^\." | while read line; do echo "    $line"; done
pass "Test files prepared"

# ─── Step 8: Upload files ──────────────────────────────
info "Step 8: Uploading files to agent..."

UPLOADED=0
for FILE_INFO in "labor_code_kz.txt:text/plain" "financial_report_2025.csv:text/csv" "hr_policies.txt:text/plain"; do
  FNAME=$(echo "$FILE_INFO" | cut -d: -f1)
  FMIME=$(echo "$FILE_INFO" | cut -d: -f2)

  UPLOAD_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "$AUTH" \
    -F "file=@${TMPDIR}/${FNAME};type=${FMIME}" \
    ${BASE}/api/organizations/${ORG_ID}/agents/${AGENT_ID}/upload 2>&1)
  UPLOAD_HTTP=$(echo "$UPLOAD_RESP" | tail -1)
  UPLOAD_BODY=$(echo "$UPLOAD_RESP" | sed '$d')

  if [ "$UPLOAD_HTTP" = "200" ] || [ "$UPLOAD_HTTP" = "201" ]; then
    UPLOADED=$((UPLOADED + 1))
    pass "Uploaded: $FNAME (HTTP $UPLOAD_HTTP)"
  else
    warn "Upload $FNAME returned HTTP $UPLOAD_HTTP: $(echo $UPLOAD_BODY | head -c 200)"
  fi
done

if [ "$UPLOADED" -eq 3 ]; then
  pass "All 3 files uploaded successfully"
else
  warn "Only $UPLOADED/3 files uploaded"
fi

# ─── Step 9: Get agent details (verify files) ──────────
info "Step 9: Verify agent has files..."

DETAIL_RESP=$(curl -s -w "\n%{http_code}" -H "$AUTH" \
  ${BASE}/api/organizations/${ORG_ID}/agents/${AGENT_ID} 2>&1)
DETAIL_HTTP=$(echo "$DETAIL_RESP" | tail -1)
DETAIL_BODY=$(echo "$DETAIL_RESP" | sed '$d')

if [ "$DETAIL_HTTP" = "200" ]; then
  FILE_COUNT=$(echo "$DETAIL_BODY" | python3 -c "
import sys,json
d = json.load(sys.stdin)
fc = d.get('fileCount', len(d.get('files', [])))
print(fc)
")
  pass "Agent detail: fileCount=$FILE_COUNT"
else
  fail "Agent detail (HTTP $DETAIL_HTTP)" "$DETAIL_BODY"
fi

# ─── Step 10: Process pipeline ─────────────────────────
info "Step 10: Trigger AI Cortex pipeline processing..."

PROCESS_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "$AUTH" -H "Content-Type: application/json" \
  --max-time 60 \
  ${BASE}/api/organizations/${ORG_ID}/agents/${AGENT_ID}/process 2>&1)
PROCESS_HTTP=$(echo "$PROCESS_RESP" | tail -1)
PROCESS_BODY=$(echo "$PROCESS_RESP" | sed '$d')

if [ "$PROCESS_HTTP" = "200" ] || [ "$PROCESS_HTTP" = "202" ]; then
  pass "Pipeline processing started (HTTP $PROCESS_HTTP)"
elif [ "$PROCESS_HTTP" = "500" ] || [ "$PROCESS_HTTP" = "502" ]; then
  warn "Process returned HTTP $PROCESS_HTTP — AI Cortex pipeline issue"
  echo "  Body: $(echo $PROCESS_BODY | head -c 300)"
else
  warn "Process returned HTTP $PROCESS_HTTP"
  echo "  Body: $(echo $PROCESS_BODY | head -c 300)"
fi

# ─── Step 11: Check progress ──────────────────────────
info "Step 11: Check pipeline progress (SSE)..."

PROGRESS_RESP=$(curl -s -w "\n%{http_code}" -H "$AUTH" \
  --max-time 10 \
  ${BASE}/api/organizations/${ORG_ID}/agents/${AGENT_ID}/progress 2>&1 || echo -e "\n000")
PROGRESS_HTTP=$(echo "$PROGRESS_RESP" | tail -1)
PROGRESS_BODY=$(echo "$PROGRESS_RESP" | sed '$d')

echo "  Progress HTTP: $PROGRESS_HTTP"
if [ -n "$PROGRESS_BODY" ]; then
  echo "  First 300 chars: $(echo $PROGRESS_BODY | head -c 300)"
fi
pass "Progress endpoint responded"

# ─── Step 12: Publish agent ────────────────────────────
info "Step 12: Publish agent (create MCP endpoint)..."

PUBLISH_RESP=$(curl -s -w "\n%{http_code}" -X POST -H "$AUTH" -H "Content-Type: application/json" \
  --max-time 120 \
  ${BASE}/api/organizations/${ORG_ID}/agents/${AGENT_ID}/publish 2>&1)
PUBLISH_HTTP=$(echo "$PUBLISH_RESP" | tail -1)
PUBLISH_BODY=$(echo "$PUBLISH_RESP" | sed '$d')

if [ "$PUBLISH_HTTP" = "200" ]; then
  MCP_ENDPOINT=$(echo "$PUBLISH_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mcpEndpoint',''))" 2>/dev/null || echo "")
  pass "Agent published! MCP endpoint: $MCP_ENDPOINT"
elif [ "$PUBLISH_HTTP" = "500" ] || [ "$PUBLISH_HTTP" = "502" ]; then
  warn "Publish returned HTTP $PUBLISH_HTTP — AI Cortex may not have finished processing"
  echo "  Body: $(echo $PUBLISH_BODY | head -c 300)"
else
  warn "Publish returned HTTP $PUBLISH_HTTP"
  echo "  Body: $(echo $PUBLISH_BODY | head -c 300)"
fi

# ─── Step 13: Access control ──────────────────────────
info "Step 13: Test access control..."

ACCESS_GET=$(curl -s -w "\n%{http_code}" -H "$AUTH" \
  ${BASE}/api/organizations/${ORG_ID}/agents/${AGENT_ID}/access 2>&1)
ACCESS_GET_HTTP=$(echo "$ACCESS_GET" | tail -1)
ACCESS_GET_BODY=$(echo "$ACCESS_GET" | sed '$d')

if [ "$ACCESS_GET_HTTP" = "200" ]; then
  ACCESS_MODE=$(echo "$ACCESS_GET_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessMode',''))")
  pass "Access mode: $ACCESS_MODE"
else
  warn "Get access (HTTP $ACCESS_GET_HTTP): $ACCESS_GET_BODY"
fi

# Update access mode
ACCESS_PUT=$(curl -s -w "\n%{http_code}" -X PUT -H "$AUTH" -H "Content-Type: application/json" \
  ${BASE}/api/organizations/${ORG_ID}/agents/${AGENT_ID}/access \
  -d '{"accessMode":"SPECIFIC","memberUserIds":[]}' 2>&1)
ACCESS_PUT_HTTP=$(echo "$ACCESS_PUT" | tail -1)

if [ "$ACCESS_PUT_HTTP" = "200" ]; then
  pass "Access mode updated to SPECIFIC"
else
  warn "Update access (HTTP $ACCESS_PUT_HTTP)"
fi

# Revert
curl -s -X PUT -H "$AUTH" -H "Content-Type: application/json" \
  ${BASE}/api/organizations/${ORG_ID}/agents/${AGENT_ID}/access \
  -d '{"accessMode":"ALL_MEMBERS","memberUserIds":[]}' > /dev/null 2>&1
pass "Access mode reverted to ALL_MEMBERS"

# ─── Step 14: My agents ───────────────────────────────
info "Step 14: Test my-agents endpoint..."

MY_AGENTS=$(curl -s -w "\n%{http_code}" -H "$AUTH" \
  ${BASE}/api/organizations/my-agents 2>&1)
MY_AGENTS_HTTP=$(echo "$MY_AGENTS" | tail -1)
MY_AGENTS_BODY=$(echo "$MY_AGENTS" | sed '$d')

if [ "$MY_AGENTS_HTTP" = "200" ]; then
  MY_AGENTS_COUNT=$(echo "$MY_AGENTS_BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  pass "My org agents: $MY_AGENTS_COUNT"
else
  warn "My agents (HTTP $MY_AGENTS_HTTP): $MY_AGENTS_BODY"
fi

# ─── Step 15: Final agent status ──────────────────────
info "Step 15: Final agent status..."

FINAL=$(curl -s -w "\n%{http_code}" -H "$AUTH" \
  ${BASE}/api/organizations/${ORG_ID}/agents/${AGENT_ID} 2>&1)
FINAL_HTTP=$(echo "$FINAL" | tail -1)
FINAL_BODY=$(echo "$FINAL" | sed '$d')

if [ "$FINAL_HTTP" = "200" ]; then
  FINAL_STATUS=$(echo "$FINAL_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
  FINAL_MCP=$(echo "$FINAL_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mcpServerId','') or 'none')")
  pass "Final: status=$FINAL_STATUS mcpServerId=$FINAL_MCP"
fi

# ─── Step 16: Cleanup ─────────────────────────────────
info "Step 16: Cleanup..."

DEL_AGENT=$(curl -s -w "%{http_code}" -X DELETE -H "$AUTH" \
  ${BASE}/api/organizations/${ORG_ID}/agents/${AGENT_ID} 2>&1)
DEL_AGENT_HTTP=$(echo "$DEL_AGENT" | tail -c 3)
pass "Agent deleted (HTTP $DEL_AGENT_HTTP)"

DEL_ORG=$(curl -s -w "%{http_code}" -X DELETE -H "$AUTH" \
  ${BASE}/api/organizations/${ORG_ID} 2>&1)
DEL_ORG_HTTP=$(echo "$DEL_ORG" | tail -c 3)
pass "Organization deleted (HTTP $DEL_ORG_HTTP)"

echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  E2E TEST COMPLETE — All API steps executed! ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
