"use client";

import { useState, useEffect } from "react";
import { Shield, CheckCircle, XCircle, AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface PublicAgent {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
  isPublic: boolean;
  status: string;
  user: { id: string; name: string | null; email: string };
  _count: { conversations: number };
  createdAt: string;
}

interface Report {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  resolvedBy: string | null;
  resolution: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Черновик", color: "text-text-muted bg-surface-alt" },
  PENDING: { label: "На проверке", color: "text-warning bg-warning/10" },
  APPROVED: { label: "Одобрен", color: "text-success bg-success/10" },
  REJECTED: { label: "Отклонён", color: "text-error bg-error/10" },
};

const REPORT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Ожидает", color: "text-warning bg-warning/10" },
  REVIEWED: { label: "Просмотрена", color: "text-accent bg-accent/10" },
  ACTION_TAKEN: { label: "Меры приняты", color: "text-success bg-success/10" },
  DISMISSED: { label: "Отклонена", color: "text-text-muted bg-surface-alt" },
};

type Tab = "agents" | "reports";

export default function AgentModerationPage() {
  const [tab, setTab] = useState<Tab>("agents");
  const [agents, setAgents] = useState<PublicAgent[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");

  const fetchAgents = async () => {
    const res = await fetch(`/api/admin/agents?status=${statusFilter}`);
    setAgents(await res.json());
  };

  const fetchReports = async () => {
    const res = await fetch("/api/admin/reports?status=PENDING");
    setReports(await res.json());
  };

  useEffect(() => {
    Promise.all([fetchAgents(), fetchReports()]).then(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAgents(); }, [statusFilter]);

  const handleAgentStatus = async (agentId: string, status: string) => {
    await fetch("/api/admin/agents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, status }),
    });
    fetchAgents();
  };

  const handleReportResolve = async (reportId: string, status: string, resolution?: string) => {
    await fetch(`/api/admin/reports/${reportId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution }),
    });
    fetchReports();
  };

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-24" />)}</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Модерация агентов</h1>
        <p className="text-sm text-text-muted mt-1">Проверка публичных агентов и обработка жалоб</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-surface-alt rounded-xl p-1 w-fit">
        {([
          { key: "agents", label: "Агенты", icon: Shield, count: agents.length },
          { key: "reports", label: "Жалобы", icon: AlertTriangle, count: reports.length },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${tab === key ? "bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
            {count > 0 && <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{count}</span>}
          </button>
        ))}
      </div>

      {tab === "agents" && (
        <>
          {/* Status filter */}
          <div className="flex gap-1 mb-4">
            {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${statusFilter === key ? "bg-accent text-white" : "bg-surface-alt text-text-muted hover:text-text-primary"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {agents.map((a) => (
              <div key={a.id} className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: a.iconColor }}>{a.icon.charAt(0)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{a.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_LABELS[a.status]?.color || ""}`}>
                          {STATUS_LABELS[a.status]?.label || a.status}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        {a.user.name || a.user.email} &middot; {a._count.conversations} бесед
                      </p>
                      {a.description && <p className="text-xs text-text-muted mt-1 line-clamp-2">{a.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {a.status !== "APPROVED" && (
                      <Button variant="secondary" size="sm" onClick={() => handleAgentStatus(a.id, "APPROVED")}>
                        <CheckCircle className="h-3.5 w-3.5 text-success" /> Одобрить
                      </Button>
                    )}
                    {a.status !== "REJECTED" && (
                      <Button variant="secondary" size="sm" onClick={() => handleAgentStatus(a.id, "REJECTED")}>
                        <XCircle className="h-3.5 w-3.5 text-error" /> Отклонить
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {agents.length === 0 && <p className="text-sm text-text-muted text-center py-8">Нет агентов для модерации</p>}
          </div>
        </>
      )}

      {tab === "reports" && (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="h-4 w-4 text-text-muted" />
                    <Badge variant="default">{r.targetType === "agent" ? "Агент" : "Скилл"}</Badge>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${REPORT_STATUS_LABELS[r.status]?.color || ""}`}>
                      {REPORT_STATUS_LABELS[r.status]?.label || r.status}
                    </span>
                    <span className="text-xs text-text-muted">{new Date(r.createdAt).toLocaleDateString("ru-RU")}</span>
                  </div>
                  <p className="text-sm text-text-primary mt-1">{r.reason}</p>
                  <p className="text-xs text-text-muted mt-1">ID: {r.targetId}</p>
                </div>
                {r.status === "PENDING" && (
                  <div className="flex gap-1 ml-3">
                    <Button variant="secondary" size="sm" onClick={() => handleReportResolve(r.id, "ACTION_TAKEN", "Меры приняты")}>
                      <CheckCircle className="h-3 w-3" /> Принять
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleReportResolve(r.id, "DISMISSED")}>
                      <XCircle className="h-3 w-3" /> Отклонить
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {reports.length === 0 && <p className="text-sm text-text-muted text-center py-8">Жалоб нет</p>}
        </div>
      )}
    </div>
  );
}
