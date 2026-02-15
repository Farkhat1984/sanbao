#!/bin/bash
# Start all MCP servers via supergateway (stdio → Streamable HTTP)
# Each server runs as a background process on its assigned port.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs/mcp"
PID_DIR="$PROJECT_DIR/logs/mcp/pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

# Kill any previously running MCP servers
if [ -d "$PID_DIR" ]; then
  for pidfile in "$PID_DIR"/*.pid; do
    [ -f "$pidfile" ] || continue
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "Stopped PID $pid ($(basename "$pidfile" .pid))"
    fi
    rm -f "$pidfile"
  done
fi

# Database URL for PostgreSQL MCP (use Docker-exposed port)
DB_URL="${POSTGRES_MCP_DB_URL:-postgresql://postgres:postgres@localhost:5436/sanbao}"

start_mcp() {
  local name="$1"
  local port="$2"
  local cmd="$3"

  echo -n "Starting $name on port $port... "

  npx -y supergateway \
    --stdio "$cmd" \
    --port "$port" \
    --outputTransport streamableHttp \
    --streamableHttpPath /mcp \
    --logLevel none \
    > "$LOG_DIR/$name.log" 2>&1 &

  local pid=$!
  echo "$pid" > "$PID_DIR/$name.pid"

  # Wait a moment and check if still alive
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    echo "OK (PID $pid)"
  else
    echo "FAILED (check $LOG_DIR/$name.log)"
  fi
}

echo "=== Starting MCP Servers ==="
echo ""

# 1. GitHub (port 3101)
start_mcp "github" 3101 \
  "npx -y @modelcontextprotocol/server-github"

# 2. PostgreSQL (port 3102)
export DATABASE_URL="$DB_URL"
start_mcp "postgres" 3102 \
  "npx -y @modelcontextprotocol/server-postgres $DB_URL"

# 3. Brave Search (port 3103)
start_mcp "brave-search" 3103 \
  "npx -y @modelcontextprotocol/server-brave-search"

# 4. Filesystem (port 3104)
start_mcp "filesystem" 3104 \
  "npx -y @modelcontextprotocol/server-filesystem $PROJECT_DIR"

# 5. Playwright (port 3105)
start_mcp "playwright" 3105 \
  "npx -y @playwright/mcp@latest"

echo ""
echo "=== Status ==="
for port in 3101 3102 3103 3104 3105; do
  name=$(ls "$PID_DIR"/*.pid 2>/dev/null | while read f; do
    p=$(cat "$f"); pn=$(basename "$f" .pid)
    echo "$pn $p"
  done | awk -v port="$port" '{print $1}')

  if curl -sf --max-time 3 -X POST "http://localhost:$port/mcp" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
    > /dev/null 2>&1; then
    echo "  Port $port: ✓ CONNECTED"
  else
    echo "  Port $port: ✗ NOT READY (may need API key or more time)"
  fi
done

echo ""
echo "Logs: $LOG_DIR/"
echo "PIDs: $PID_DIR/"
echo ""
echo "To stop all: kill \$(cat $PID_DIR/*.pid)"
