#!/usr/bin/env python3
"""
Failover Monitoring Telegram Bot with Automatic Failover.

Password-protected bot for server health monitoring,
sync management, backup triggering, and failover control.

Auto-failover: if Server 1 sanbao is unreachable for 3 consecutive
checks (90s), cloudflared starts on Server 2 automatically.
Auto-failback: if Server 1 recovers for 3 consecutive checks (90s)
after cooldown (5min), cloudflared stops and traffic returns.
"""

import asyncio
import json
import logging
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
    ContextTypes,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config ──────────────────────────────────────────────────────────────────
BOT_TOKEN = os.environ["TG_BOT_TOKEN"]
TG_CHAT_ID = os.getenv("TG_CHAT_ID", "")
AUTH_PASSWORD = os.getenv("BOT_PASSWORD", "Ckdshfh231161!")
PRIMARY_IP = os.getenv("PRIMARY_IP", "128.127.102.170")
STANDBY_IP = os.getenv("STANDBY_IP", "46.225.122.142")
SANBAO_PORT = os.getenv("SANBAO_PORT", "3004")
FRAGMENTDB_PORT = os.getenv("FRAGMENTDB_PORT", "8110")
DEPLOY_DIR = os.getenv("DEPLOY_DIR", "/deploy")
AUTH_FILE = "/data/authorized_users.json"
SYNC_SSH_USER = os.getenv("SYNC_SSH_USER", "metadmin")
SYNC_SSH_HOST = os.getenv("SYNC_SSH_HOST", PRIMARY_IP)
SYNC_SSH_PORT = os.getenv("SYNC_SSH_PORT", "22")

# ── Auto-failover config ───────────────────────────────────────────────────
MONITOR_INTERVAL = 30          # seconds between health checks
FAILOVER_THRESHOLD = 3         # consecutive failures before auto-failover (90s)
RECOVERY_THRESHOLD = 3         # consecutive recoveries before auto-failback (90s)
COOLDOWN_SECONDS = 300         # 5 min cooldown after any switch
STATE_FILE = Path("/tmp/failover-state")
COMPOSE_FILE = f"{DEPLOY_DIR}/docker-compose.failover.yml"

# ── Auto-failover state (in-memory) ────────────────────────────────────────
consecutive_failures = 0
consecutive_recoveries = 0
last_switch_time = 0.0         # monotonic timestamp of last failover/failback
failover_active = False

# ── Server 2 local health state ───────────────────────────────────────────
ORCHESTRATOR_PORT = os.getenv("ORCHESTRATOR_PORT", "8120")
S2_ALERT_THRESHOLD = 2         # consecutive failures before alerting (60s)
# Docker service names (bot runs in same compose network)
# Internal ports: sanbao=3004, fragmentdb=8080, orchestrator=8120
S2_SERVICES: dict[str, dict] = {
    "Sanbao":      {"url": "http://sanbao:3004/api/ready"},
    "FragmentDB":  {"url": "http://fragmentdb:8080/health"},
    "Orchestrator": {"url": "http://orchestrator:8120/health"},
}
# Track per-service: {"Sanbao": True/False/None} — None = unknown (first run)
s2_health_state: dict[str, bool | None] = {n: None for n in S2_SERVICES}
s2_fail_counts: dict[str, int] = {n: 0 for n in S2_SERVICES}

# ── Server 1 AI Cortex health state (checked via SSH) ────────────────────
S1_CORTEX_SERVICES: dict[str, dict] = {
    "FragmentDB":   {"port": FRAGMENTDB_PORT, "path": "/health"},
    "Orchestrator": {"port": ORCHESTRATOR_PORT, "path": "/health"},
}
s1_cortex_health_state: dict[str, bool | None] = {n: None for n in S1_CORTEX_SERVICES}
s1_cortex_fail_counts: dict[str, int] = {n: 0 for n in S1_CORTEX_SERVICES}
S1_CORTEX_ALERT_THRESHOLD = 2  # consecutive failures before alerting (60s)


# ── Auth persistence ────────────────────────────────────────────────────────
def load_authorized() -> set[int]:
    try:
        with open(AUTH_FILE) as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_authorized(users: set[int]) -> None:
    Path(AUTH_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(AUTH_FILE, "w") as f:
        json.dump(list(users), f)


authorized_users = load_authorized()


def is_authorized(user_id: int) -> bool:
    return user_id in authorized_users


def require_auth(func):
    """Decorator: reject unauthorized users."""
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if not is_authorized(update.effective_user.id):
            await update.message.reply_text("🔐 Авторизуйтесь: отправьте пароль.")
            return
        return await func(update, context)
    return wrapper


# ── Helpers ─────────────────────────────────────────────────────────────────
async def check_url(url: str, timeout: int = 8, any_response: bool = False) -> tuple[bool, str]:
    """Check HTTP endpoint, return (ok, detail).

    If any_response=True, any HTTP status counts as alive (for services
    where /health may require auth but responding means the process is up).
    """
    import aiohttp
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as r:
                body = await r.text()
                if r.status == 200 or any_response:
                    return True, body[:200]
                return False, f"HTTP {r.status}"
    except Exception as e:
        return False, str(e)[:120]


def run_shell(cmd: str, timeout: int = 120) -> tuple[int, str]:
    """Run shell command, return (returncode, output)."""
    try:
        r = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout,
        )
        out = (r.stdout + r.stderr).strip()
        return r.returncode, out[-2000:] if len(out) > 2000 else out
    except subprocess.TimeoutExpired:
        return 1, "Timeout"
    except Exception as e:
        return 1, str(e)


def check_s1_sanbao_sync() -> bool:
    """Check Server 1 sanbao health via SSH (blocking)."""
    rc, _ = run_shell(
        f'ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p {SYNC_SSH_PORT} '
        f'{SYNC_SSH_USER}@{SYNC_SSH_HOST} '
        f'"curl -sf --max-time 5 http://localhost:{SANBAO_PORT}/api/ready"',
        timeout=15,
    )
    return rc == 0


def check_s1_cortex_service(port: str, path: str) -> tuple[bool, str]:
    """Check a Server 1 AI Cortex service via SSH (blocking)."""
    rc, out = run_shell(
        f'ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p {SYNC_SSH_PORT} '
        f'{SYNC_SSH_USER}@{SYNC_SSH_HOST} '
        f'"curl -sf --max-time 5 http://localhost:{port}{path}"',
        timeout=15,
    )
    return (rc == 0, out[:200] if rc == 0 else "unreachable")


def verify_cloudflared_running(retries: int = 3, wait: int = 5) -> tuple[bool, str]:
    """Verify cloudflared is actually running after docker compose up.

    docker compose up -d returns 0 even when the container immediately
    crashes. This function waits and checks that the container is truly
    running (not in a restart loop).
    """
    for i in range(retries):
        time.sleep(wait)
        rc, out = run_shell(
            "docker ps --filter name=cloudflared --format '{{.Status}}'",
            timeout=10,
        )
        if rc == 0 and out and "Up" in out and "Restarting" not in out:
            return True, "cloudflared running"
    # Get logs for error details
    _, logs = run_shell("docker logs deploy-cloudflared-1 --tail 5 2>&1", timeout=10)
    return False, f"cloudflared not running after {retries * wait}s: {logs[:300]}"


def write_state(active: bool, fail_count: int = 0) -> None:
    """Persist failover state to disk."""
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(
            f"FAILOVER_ACTIVE={'true' if active else 'false'}\n"
            f"FAIL_COUNT={fail_count}\n"
            f"UPDATED={datetime.now(timezone.utc).isoformat()}\n"
        )
    except Exception as e:
        logger.error("Failed to write state file: %s", e)


def read_state() -> bool:
    """Read failover state from disk."""
    try:
        if STATE_FILE.exists():
            content = STATE_FILE.read_text()
            return "FAILOVER_ACTIVE=true" in content
    except Exception:
        pass
    return False


async def send_telegram_async(message: str) -> None:
    """Send Telegram notification to the configured chat."""
    if not TG_CHAT_ID:
        logger.warning("TG_CHAT_ID not set, skipping notification")
        return
    import aiohttp
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        async with aiohttp.ClientSession() as session:
            await session.post(url, data={
                "chat_id": TG_CHAT_ID,
                "text": message,
                "parse_mode": "HTML",
            }, timeout=aiohttp.ClientTimeout(total=10))
    except Exception as e:
        logger.error("Telegram notification failed: %s", e)


# ── Auto-failover monitoring loop ──────────────────────────────────────────
async def auto_monitor_loop() -> None:
    """Background loop: check Server 1 health, auto-failover/failback."""
    global consecutive_failures, consecutive_recoveries
    global last_switch_time, failover_active

    # Restore state from disk on startup
    failover_active = read_state()
    if failover_active:
        logger.info("Restored failover state: ACTIVE")

    logger.info(
        "Auto-monitor started: interval=%ds, failover_threshold=%d, "
        "recovery_threshold=%d, cooldown=%ds",
        MONITOR_INTERVAL, FAILOVER_THRESHOLD,
        RECOVERY_THRESHOLD, COOLDOWN_SECONDS,
    )

    while True:
        try:
            # Check Server 1 sanbao health (runs in thread to avoid blocking)
            s1_ok = await asyncio.to_thread(check_s1_sanbao_sync)

            now = time.monotonic()
            in_cooldown = (now - last_switch_time) < COOLDOWN_SECONDS

            if s1_ok:
                # Server 1 is healthy
                consecutive_failures = 0
                consecutive_recoveries += 1

                if failover_active and not in_cooldown:
                    if consecutive_recoveries >= RECOVERY_THRESHOLD:
                        # Auto-failback: stop cloudflared, keep sanbao as warm standby
                        logger.info("Auto-failback: Server 1 recovered (%d consecutive OKs)", consecutive_recoveries)
                        rc, out = run_shell(
                            f"cd {DEPLOY_DIR} && docker compose -f {COMPOSE_FILE} stop cloudflared 2>&1",
                            timeout=60,
                        )
                        if rc == 0:
                            failover_active = False
                            consecutive_recoveries = 0
                            last_switch_time = time.monotonic()
                            write_state(False)
                            logger.info("Auto-failback completed successfully")
                            await send_telegram_async(
                                "✅ <b>Auto-failback выполнен</b>\n\n"
                                f"Server 1 ({PRIMARY_IP}) восстановлен и отвечает "
                                f"{RECOVERY_THRESHOLD} проверок подряд.\n"
                                "Cloudflared на Server 2 остановлен, трафик вернулся на Server 1.\n"
                                "Sanbao на Server 2 продолжает работать как warm standby."
                            )
                        else:
                            logger.error("Auto-failback failed: %s", out)
                            await send_telegram_async(
                                "❌ <b>Auto-failback не удался</b>\n\n"
                                f"<pre>{out[:500]}</pre>"
                            )
                elif failover_active and in_cooldown:
                    remaining = int(COOLDOWN_SECONDS - (now - last_switch_time))
                    if consecutive_recoveries == 1:
                        logger.info("Server 1 recovering, but in cooldown (%ds remaining)", remaining)
            else:
                # Server 1 is down
                consecutive_recoveries = 0
                consecutive_failures += 1

                if not failover_active and not in_cooldown:
                    if consecutive_failures >= FAILOVER_THRESHOLD:
                        # Auto-failover: start cloudflared on Server 2
                        logger.info("Auto-failover: Server 1 down (%d consecutive failures)", consecutive_failures)
                        rc, out = run_shell(
                            f"cd {DEPLOY_DIR} && docker compose -f {COMPOSE_FILE} --profile failover up -d cloudflared 2>&1",
                            timeout=120,
                        )
                        if rc == 0:
                            # Verify cloudflared is actually running (not crash-looping)
                            cf_ok, cf_detail = await asyncio.to_thread(verify_cloudflared_running)
                            if cf_ok:
                                failover_active = True
                                consecutive_failures = 0
                                last_switch_time = time.monotonic()
                                write_state(True, 0)
                                logger.info("Auto-failover completed successfully")
                                await send_telegram_async(
                                    "⚠️ <b>Auto-failover выполнен</b>\n\n"
                                    f"Server 1 ({PRIMARY_IP}) недоступен "
                                    f"{FAILOVER_THRESHOLD * MONITOR_INTERVAL}с "
                                    f"({FAILOVER_THRESHOLD} проверок подряд).\n"
                                    f"Cloudflared запущен на Server 2 ({STANDBY_IP}), "
                                    "трафик переключён.\n\n"
                                    "Для ручного возврата: /failback"
                                )
                            else:
                                logger.error("Auto-failover: cloudflared started but crashed: %s", cf_detail)
                                await send_telegram_async(
                                    "🔴 <b>Auto-failover: cloudflared не запустился!</b>\n\n"
                                    "docker compose up вернул 0, но контейнер упал.\n"
                                    f"<pre>{cf_detail}</pre>\n\n"
                                    "Требуется ручное вмешательство!"
                                )
                        else:
                            logger.error("Auto-failover failed: %s", out)
                            await send_telegram_async(
                                "🔴 <b>Auto-failover не удался!</b>\n\n"
                                f"Server 1 недоступен, но запуск cloudflared провалился.\n"
                                f"<pre>{out[:500]}</pre>\n\n"
                                "Требуется ручное вмешательство: /failover"
                            )
                    elif consecutive_failures == 1:
                        logger.warning("Server 1 sanbao check failed (1/%d)", FAILOVER_THRESHOLD)
                elif not failover_active and in_cooldown:
                    if consecutive_failures == 1:
                        remaining = int(COOLDOWN_SECONDS - (now - last_switch_time))
                        logger.warning("Server 1 down but in cooldown (%ds remaining)", remaining)

            # ── Server 1 AI Cortex health checks (via SSH) ─────────────────
            for svc_name, svc_cfg in S1_CORTEX_SERVICES.items():
                try:
                    svc_ok, svc_detail = await asyncio.to_thread(
                        check_s1_cortex_service,
                        svc_cfg["port"], svc_cfg["path"],
                    )
                except Exception as exc:
                    svc_ok, svc_detail = False, str(exc)[:120]

                prev_state = s1_cortex_health_state[svc_name]

                if svc_ok:
                    s1_cortex_fail_counts[svc_name] = 0
                    if prev_state is False:
                        s1_cortex_health_state[svc_name] = True
                        logger.info("S1 AI Cortex %s recovered", svc_name)
                        await send_telegram_async(
                            f"✅ <b>Server 1 AI Cortex {svc_name} восстановлен</b>\n\n"
                            f"Сервис снова отвечает на health check."
                        )
                    elif prev_state is None:
                        s1_cortex_health_state[svc_name] = True
                else:
                    s1_cortex_fail_counts[svc_name] += 1
                    if prev_state is not False and s1_cortex_fail_counts[svc_name] >= S1_CORTEX_ALERT_THRESHOLD:
                        s1_cortex_health_state[svc_name] = False
                        logger.warning("S1 AI Cortex %s is DOWN: %s", svc_name, svc_detail)
                        await send_telegram_async(
                            f"🔴 <b>Server 1 AI Cortex {svc_name} упал!</b>\n\n"
                            f"Не отвечает {s1_cortex_fail_counts[svc_name]} проверок подряд "
                            f"({s1_cortex_fail_counts[svc_name] * MONITOR_INTERVAL}с).\n"
                            f"Ошибка: <code>{svc_detail}</code>\n\n"
                            f"Проверьте: <code>docker logs sanbao-{svc_name.lower()}-1 --tail 20</code>"
                        )
                    elif prev_state is None and s1_cortex_fail_counts[svc_name] >= S1_CORTEX_ALERT_THRESHOLD:
                        s1_cortex_health_state[svc_name] = False
                        logger.warning("S1 AI Cortex %s is DOWN on startup: %s", svc_name, svc_detail)
                        await send_telegram_async(
                            f"🔴 <b>Server 1 AI Cortex {svc_name} не работает!</b>\n\n"
                            f"Сервис недоступен при запуске бота.\n"
                            f"Ошибка: <code>{svc_detail}</code>"
                        )

            # ── Server 2 local health checks ──────────────────────────────
            for svc_name, svc_cfg in S2_SERVICES.items():
                try:
                    svc_ok, svc_detail = await check_url(
                        svc_cfg["url"], timeout=5,
                        any_response=svc_cfg.get("any_response", False),
                    )
                except Exception as exc:
                    svc_ok, svc_detail = False, str(exc)[:120]

                prev_state = s2_health_state[svc_name]

                if svc_ok:
                    s2_fail_counts[svc_name] = 0
                    if prev_state is False:
                        # Recovered
                        s2_health_state[svc_name] = True
                        logger.info("S2 %s recovered", svc_name)
                        await send_telegram_async(
                            f"✅ <b>Server 2 {svc_name} восстановлен</b>\n\n"
                            f"Сервис снова отвечает на health check."
                        )
                    elif prev_state is None:
                        s2_health_state[svc_name] = True
                else:
                    s2_fail_counts[svc_name] += 1
                    if prev_state is not False and s2_fail_counts[svc_name] >= S2_ALERT_THRESHOLD:
                        # Went down
                        s2_health_state[svc_name] = False
                        logger.warning("S2 %s is DOWN: %s", svc_name, svc_detail)
                        await send_telegram_async(
                            f"🔴 <b>Server 2 {svc_name} упал!</b>\n\n"
                            f"Не отвечает {s2_fail_counts[svc_name]} проверок подряд "
                            f"({s2_fail_counts[svc_name] * MONITOR_INTERVAL}с).\n"
                            f"Ошибка: <code>{svc_detail}</code>\n\n"
                            f"Проверьте: <code>docker logs deploy-{svc_name.lower()}-1 --tail 20</code>"
                        )
                    elif prev_state is None and s2_fail_counts[svc_name] >= S2_ALERT_THRESHOLD:
                        # Was unknown at startup and still down
                        s2_health_state[svc_name] = False
                        logger.warning("S2 %s is DOWN on startup: %s", svc_name, svc_detail)
                        await send_telegram_async(
                            f"🔴 <b>Server 2 {svc_name} не работает!</b>\n\n"
                            f"Сервис недоступен при запуске бота.\n"
                            f"Ошибка: <code>{svc_detail}</code>"
                        )

        except Exception as e:
            logger.error("Monitor loop error: %s", e)

        await asyncio.sleep(MONITOR_INTERVAL)


# ── Commands ────────────────────────────────────────────────────────────────

HELP_TEXT = """
<b>Команды мониторинга:</b>

/status  — статус обоих серверов
/sync    — запустить синхронизацию
/backup  — запустить бекап
/logs    — последние логи синхронизации
/docker  — статус контейнеров
/disk    — место на диске
/failover — ручной failover
/failback — вернуть на Server 1
/help    — эта справка

<b>Авто-failover:</b> если Server 1 недоступен 90с → автопереключение.
Авто-failback через 90с + 5мин cooldown после восстановления.
<b>Авто-мониторинг S1:</b> AI Cortex (FragmentDB, Orchestrator) — алерт при падении/восстановлении.
<b>Авто-мониторинг S2:</b> Sanbao, FragmentDB, Orchestrator — алерт при падении/восстановлении.
"""


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    uid = update.effective_user.id
    if is_authorized(uid):
        await update.message.reply_text(
            f"✅ Вы авторизованы.\n{HELP_TEXT}", parse_mode="HTML",
        )
    else:
        await update.message.reply_text(
            "🔐 <b>Бот мониторинга серверов</b>\n\nВведите пароль для авторизации:",
            parse_mode="HTML",
        )


@require_auth
async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(HELP_TEXT, parse_mode="HTML")


@require_auth
async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = await update.message.reply_text("⏳ Проверяю серверы...")

    async def check_via_ssh(port: str, path: str) -> tuple[bool, str]:
        rc, out = await asyncio.to_thread(
            run_shell,
            f'ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p {SYNC_SSH_PORT} {SYNC_SSH_USER}@{SYNC_SSH_HOST} '
            f'"curl -sf --max-time 5 http://localhost:{port}{path}"',
            15,
        )
        return (rc == 0, out[:200] if rc == 0 else "unreachable")

    checks = await asyncio.gather(
        check_via_ssh(SANBAO_PORT, "/api/health"),
        check_via_ssh(FRAGMENTDB_PORT, "/health"),
        check_via_ssh(ORCHESTRATOR_PORT, "/health"),
        check_url("http://sanbao:3004/api/health"),
        check_url("http://fragmentdb:8080/health"),
        check_url("http://orchestrator:8120/health"),
    )

    s1_sanbao = checks[0]
    s1_fragment, s1_orch = checks[1], checks[2]
    s2_sanbao, s2_fragment, s2_orch = checks[3], checks[4], checks[5]

    def icon(ok: bool) -> str:
        return "✅" if ok else "❌"

    now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")

    # Auto-failover status
    in_cooldown = (time.monotonic() - last_switch_time) < COOLDOWN_SECONDS
    cooldown_str = ""
    if in_cooldown:
        remaining = int(COOLDOWN_SECONDS - (time.monotonic() - last_switch_time))
        cooldown_str = f"\n⏳ Cooldown: {remaining}с"

    mode = "🔴 FAILOVER (трафик на Server 2)" if failover_active else "🟢 Normal (трафик на Server 1)"

    text = f"""<b>Статус серверов</b> ({now_str})

<b>Server 1</b> ({PRIMARY_IP}) — Primary
  {icon(s1_sanbao[0])} Sanbao :{SANBAO_PORT}
  {icon(s1_fragment[0])} FragmentDB :{FRAGMENTDB_PORT}
  {icon(s1_orch[0])} Orchestrator :{ORCHESTRATOR_PORT}

<b>Server 2</b> ({STANDBY_IP}) — Standby
  {icon(s2_sanbao[0])} Sanbao :{SANBAO_PORT}
  {icon(s2_fragment[0])} FragmentDB :{FRAGMENTDB_PORT}
  {icon(s2_orch[0])} Orchestrator :{ORCHESTRATOR_PORT}

<b>Режим:</b> {mode}{cooldown_str}
<b>Мониторинг S1:</b> failures={consecutive_failures}, recoveries={consecutive_recoveries}
<b>S1 AI Cortex:</b> {', '.join(f'{n}={"ok" if s1_cortex_health_state[n] else "DOWN" if s1_cortex_health_state[n] is False else "?"}' for n in S1_CORTEX_SERVICES)}
<b>Мониторинг S2:</b> {', '.join(f'{n}={"ok" if s2_health_state[n] else "DOWN" if s2_health_state[n] is False else "?"}' for n in S2_SERVICES)}"""

    await msg.edit_text(text, parse_mode="HTML")


@require_auth
async def cmd_sync(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = await update.message.reply_text("🔄 Запускаю синхронизацию...")
    rc, out = run_shell(f"bash {DEPLOY_DIR}/sync.sh 2>&1", timeout=300)
    icon = "✅" if rc == 0 else "❌"
    await msg.edit_text(
        f"{icon} <b>Синхронизация {'завершена' if rc == 0 else 'ошибка'}</b>\n\n<pre>{out[-1500:]}</pre>",
        parse_mode="HTML",
    )


@require_auth
async def cmd_backup(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = await update.message.reply_text("💾 Запускаю бекап...")
    rc, out = run_shell(f"bash {DEPLOY_DIR}/backup.sh 2>&1", timeout=600)
    icon = "✅" if rc == 0 else "❌"
    await msg.edit_text(
        f"{icon} <b>Бекап {'завершён' if rc == 0 else 'ошибка'}</b>\n\n<pre>{out[-1500:]}</pre>",
        parse_mode="HTML",
    )


@require_auth
async def cmd_logs(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    rc, out = run_shell("tail -30 /var/log/failover-sync.log 2>/dev/null || echo 'Логов нет'")
    await update.message.reply_text(
        f"<b>Логи синхронизации (последние 30 строк):</b>\n\n<pre>{out[-3000:]}</pre>",
        parse_mode="HTML",
    )


@require_auth
async def cmd_docker(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    rc, out = run_shell("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>&1")
    await update.message.reply_text(
        f"<b>Docker контейнеры:</b>\n\n<pre>{out[-3000:]}</pre>",
        parse_mode="HTML",
    )


@require_auth
async def cmd_disk(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    rc, out = run_shell("df -h / /home 2>&1 && echo '' && du -sh /backups/* 2>/dev/null || echo 'Бекапов нет'")
    await update.message.reply_text(
        f"<b>Диск:</b>\n\n<pre>{out[-2000:]}</pre>",
        parse_mode="HTML",
    )


@require_auth
async def cmd_failover(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔴 Подтверждаю failover", callback_data="confirm_failover"),
            InlineKeyboardButton("Отмена", callback_data="cancel"),
        ]
    ])
    await update.message.reply_text(
        "⚠️ <b>Вы уверены?</b>\n\nЭто запустит cloudflared на Server 2 и переключит трафик.",
        parse_mode="HTML",
        reply_markup=keyboard,
    )


@require_auth
async def cmd_failback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🟢 Подтверждаю failback", callback_data="confirm_failback"),
            InlineKeyboardButton("Отмена", callback_data="cancel"),
        ]
    ])
    await update.message.reply_text(
        "⚠️ <b>Вернуть трафик на Server 1?</b>\n\nServer 1 должен быть запущен и здоров.",
        parse_mode="HTML",
        reply_markup=keyboard,
    )


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    global failover_active, last_switch_time, consecutive_failures, consecutive_recoveries

    query = update.callback_query
    if not is_authorized(query.from_user.id):
        await query.answer("Не авторизован")
        return

    await query.answer()
    data = query.data

    if data == "cancel":
        await query.edit_message_text("Отменено.")
        return

    if data == "confirm_failover":
        await query.edit_message_text("🔄 Запускаю failover...")
        rc, out = run_shell(
            f"cd {DEPLOY_DIR} && docker compose -f {COMPOSE_FILE} --profile failover up -d cloudflared 2>&1",
            timeout=300,
        )
        if rc == 0:
            # Verify cloudflared is actually running (not crash-looping)
            cf_ok, cf_detail = await asyncio.to_thread(verify_cloudflared_running)
            if cf_ok:
                failover_active = True
                consecutive_failures = 0
                consecutive_recoveries = 0
                last_switch_time = time.monotonic()
                write_state(True)
                await query.edit_message_text(
                    f"✅ <b>Failover выполнен</b>\n\nCloudflared запущен и работает.",
                    parse_mode="HTML",
                )
            else:
                await query.edit_message_text(
                    f"❌ <b>Failover: cloudflared не запустился</b>\n\n"
                    f"docker compose up вернул 0, но контейнер упал.\n"
                    f"<pre>{cf_detail}</pre>",
                    parse_mode="HTML",
                )
        else:
            await query.edit_message_text(
                f"❌ <b>Failover ошибка</b>\n\n<pre>{out[-1500:]}</pre>",
                parse_mode="HTML",
            )

    elif data == "confirm_failback":
        await query.edit_message_text("🔄 Запускаю failback...")
        rc, out = run_shell(f"bash {DEPLOY_DIR}/failback.sh --skip-sync 2>&1", timeout=300)
        if rc == 0:
            failover_active = False
            consecutive_failures = 0
            consecutive_recoveries = 0
            last_switch_time = time.monotonic()
            write_state(False)
        icon = "✅" if rc == 0 else "❌"
        await query.edit_message_text(
            f"{icon} <b>Failback {'выполнен' if rc == 0 else 'ошибка'}</b>\n\n<pre>{out[-1500:]}</pre>",
            parse_mode="HTML",
        )


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle plain text: password auth or unknown command."""
    uid = update.effective_user.id

    if not is_authorized(uid):
        if update.message.text.strip() == AUTH_PASSWORD:
            authorized_users.add(uid)
            save_authorized(authorized_users)
            logger.info("User %s authorized", uid)
            await update.message.reply_text(
                f"✅ Авторизация успешна!\n{HELP_TEXT}", parse_mode="HTML",
            )
        else:
            await update.message.reply_text("❌ Неверный пароль. Попробуйте ещё раз.")
    else:
        await update.message.reply_text("❓ Неизвестная команда. /help для справки.")


# ── Main ────────────────────────────────────────────────────────────────────

async def post_init(app: Application) -> None:
    """Start background monitoring after bot initialization."""
    asyncio.create_task(auto_monitor_loop())
    logger.info("Background auto-monitor task created")


def main() -> None:
    logger.info("Starting monitoring bot...")
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("sync", cmd_sync))
    app.add_handler(CommandHandler("backup", cmd_backup))
    app.add_handler(CommandHandler("logs", cmd_logs))
    app.add_handler(CommandHandler("docker", cmd_docker))
    app.add_handler(CommandHandler("disk", cmd_disk))
    app.add_handler(CommandHandler("failover", cmd_failover))
    app.add_handler(CommandHandler("failback", cmd_failback))
    app.add_handler(CallbackQueryHandler(callback_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    # Register post_init to start the background monitor
    app.post_init = post_init

    logger.info("Bot started with auto-failover monitoring. Waiting for messages...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
