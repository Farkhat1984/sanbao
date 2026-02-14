"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface HealthData {
  status: string;
  checks: Record<string, { status: string; latency?: number; error?: string }>;
  timestamp: string;
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    const res = await fetch("/api/health");
    setHealth(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchHealth(); }, []);

  const statusIcon = (s: string) => {
    if (s === "ok") return <CheckCircle className="h-5 w-5 text-success" />;
    if (s === "error") return <XCircle className="h-5 w-5 text-error" />;
    return <AlertCircle className="h-5 w-5 text-warning" />;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Health Check</h1>
          <p className="text-sm text-text-muted mt-1">Статус сервисов</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchHealth} isLoading={loading}>
          <RefreshCw className="h-3.5 w-3.5" /> Обновить
        </Button>
      </div>

      {!health ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-20" />)}</div>
      ) : (
        <>
          <div className={`bg-surface border rounded-2xl p-5 mb-6 ${health.status === "healthy" ? "border-success/30" : "border-error/30"}`}>
            <div className="flex items-center gap-3">
              {health.status === "healthy" ? <CheckCircle className="h-6 w-6 text-success" /> : <XCircle className="h-6 w-6 text-error" />}
              <div>
                <p className="text-sm font-semibold text-text-primary">{health.status === "healthy" ? "Все сервисы работают" : "Есть проблемы"}</p>
                <p className="text-xs text-text-muted">Обновлено: {new Date(health.timestamp).toLocaleString("ru-RU")}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(health.checks).map(([name, check]) => (
              <div key={name} className="bg-surface border border-border rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon(check.status)}
                  <div>
                    <p className="text-sm font-medium text-text-primary">{name}</p>
                    {check.error && <p className="text-xs text-error mt-0.5">{check.error}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {check.latency !== undefined && <span className="text-xs text-text-muted">{check.latency}ms</span>}
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${check.status === "ok" ? "bg-success/10 text-success" : check.status === "error" ? "bg-error/10 text-error" : "bg-warning/10 text-warning"}`}>{check.status}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
