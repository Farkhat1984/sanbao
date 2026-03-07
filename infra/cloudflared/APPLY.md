# Applying cloudflared config changes

## Prerequisites

1. In Cloudflare Dashboard, ensure DNS records exist:
   - `jcas.kz` → CNAME → `222e9fb5-634f-4064-a1e9-8af13f47e4f1.cfargotunnel.com` (Proxied)
   - `www.jcas.kz` → CNAME → `222e9fb5-634f-4064-a1e9-8af13f47e4f1.cfargotunnel.com` (Proxied)

   (sanbao.ai and mcp.sanbao.ai should already exist)

## Server 1 (Primary)

```bash
# 1. Copy config to server
sudo cp server1-config.yml /etc/cloudflared/config.yml

# 2. Validate config
sudo cloudflared tunnel ingress validate

# 3. Restart cloudflared
sudo systemctl restart cloudflared

# 4. Verify
sudo systemctl status cloudflared
curl -sf https://jcas.kz  # should return HTML
```

## Server 2 (Failover)

```bash
# Copy to deploy directory (used by docker-compose.failover.yml)
cp server2-config.yml ~/faragj/deploy/cloudflared/config.yml
```

No restart needed — cloudflared on Server 2 only runs during failover.

## Verification

```bash
# All 3 domains should respond:
curl -sf https://sanbao.ai/api/health        # Sanbao app
curl -sf https://jcas.kz                       # AI Cortex Web Admin
curl -sf https://mcp.sanbao.ai/health         # Orchestrator MCP
```
