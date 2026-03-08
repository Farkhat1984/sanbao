"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, CheckCircle, XCircle, AlertTriangle, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
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
  DRAFT: { label: "Черновик", color: "text-text-secondary bg-surface-alt" },
  PENDING: { label: "На проверке", color: "text-warning bg-warning/10" },
  APPROVED: { label: "Одобрен", color: "text-success bg-success/10" },
  REJECTED: { label: "Отклонён", color: "text-error bg-error/10" },
};

const REPORT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Ожидает", color: "text-warning bg-warning/10" },
  REVIEWED: { label: "Просмотрена", color: "text-accent bg-accent/10" },
  ACTION_TAKEN: { label: "Меры приняты", color: "text-success bg-success/10" },
  DISMISSED: { label: "Отклонена", color: "text-text-secondary bg-surface-alt" },
};

type Tab = "agents" | "reports";

export default function AgentModerationPage() {
  const [tab, setTab] = useState<Tab>("agents");
  const [agents, setAgents] = useState<PublicAgent[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [reportStatusFilter, setReportStatusFilter] = useState<string>("PENDING");

  const REPORTS_PER_PAGE = 25;

  const fetchAgents = async () => {
    const res = await fetch(`/api/admin/agents?status=${statusFilter}`);
    const data = await res.json();
    setAgents(Array.isArray(data) ? data : data.items ?? []);
  };

  const fetchReports = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(reportPage),
      limit: String(REPORTS_PER_PAGE),
      ...(reportStatusFilter && { status: reportStatusFilter }),
    });
    const res = await fetch(`/api/admin/reports?${params}`);
    const data = await res.json();
    setReports(data.reports || []);
    setReportTotal(data.total || 0);
  }, [reportPage, reportStatusFilter]);

  useEffect(() => {
    Promise.all([fetchAgents(), fetchReports()]).then(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAgents(); }, [statusFilter]);
  useEffect(() => { fetchReports(); }, [fetchReports]);

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
        <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">Модерация агентов</h1>
        <p className="text-sm text-text-secondary mt-1">Проверка публичных агентов и обработка жалоб</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-surface-alt rounded-xl p-1 w-fit">
        {([
          { key: "agents", label: "Агенты", icon: Shield, count: agents.length },
          { key: "reports", label: "Жалобы", icon: AlertTriangle, count: reportTotal },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${tab === key ? "bg-surface text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
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
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${statusFilter === key ? "bg-accent text-white" : "bg-surface-alt text-text-secondary hover:text-text-primary"}`}
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
                      <p className="text-xs text-text-secondary mt-0.5">
                        {a.user.name || a.user.email} &middot; {a._count.conversations} бесед
                      </p>
                      {a.description && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{a.description}</p>}
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
            {agents.length === 0 && <p className="text-sm text-text-secondary text-center py-8">Нет агентов для модерации</p>}
          </div>
        </>
      )}

      {tab === "reports" && (
        <div>
          {/* Report status filter */}
          <div className="flex gap-1 mb-4">
            {Object.entries(REPORT_STATUS_LABELS).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => { setReportStatusFilter(key); setReportPage(1); }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${reportStatusFilter === key ? "bg-accent text-white" : "bg-surface-alt text-text-secondary hover:text-text-primary"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="h-4 w-4 text-text-secondary" />
                      <Badge variant="default">{r.targetType === "agent" ? "Агент" : "Скилл"}</Badge>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${REPORT_STATUS_LABELS[r.status]?.color || ""}`}>
                        {REPORT_STATUS_LABELS[r.status]?.label || r.status}
                      </span>
                      <span className="text-xs text-text-secondary">{new Date(r.createdAt).toLocaleDateString("ru-RU")}</span>
                    </div>
                    <p className="text-sm text-text-primary mt-1">{r.reason}</p>
                    <p className="text-xs text-text-secondary mt-1">ID: {r.targetId}</p>
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
            {reports.length === 0 && <p className="text-sm text-text-secondary text-center py-8">Жалоб нет</p>}

            {/* Pagination */}
            {(() => {
              const totalPages = Math.ceil(reportTotal / REPORTS_PER_PAGE);
              if (totalPages <= 1) return null;
              return (
                <div className="flex items-center justify-between pt-3">
                  <span className="text-xs text-text-secondary">{reportTotal} жалоб</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                      disabled={reportPage === 1}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-text-secondary">{reportPage} / {totalPages}</span>
                    <button
                      onClick={() => setReportPage((p) => Math.min(totalPages, p + 1))}
                      disabled={reportPage === totalPages}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
