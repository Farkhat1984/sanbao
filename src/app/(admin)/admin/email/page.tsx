"use client";

import { useState, useEffect } from "react";
import { Envelope, CheckCircle, XCircle, PaperPlaneRight, ArrowsClockwise, NotePencil, FloppyDisk } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: string;
  error: string | null;
  createdAt: string;
}

interface EmailTemplate {
  id: string | null;
  type: string;
  subject: string;
  html: string;
  isActive: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  WELCOME: "Приветствие",
  INVOICE: "Счёт",
  SUBSCRIPTION_EXPIRING: "Истечение подписки",
  PAYMENT_FAILED: "Ошибка оплаты",
  PASSWORD_RESET: "Сброс пароля",
  EMAIL_VERIFICATION: "Подтверждение email",
};

const TYPE_VARS: Record<string, string> = {
  WELCOME: "{{userName}}",
  INVOICE: "{{userName}}, {{planName}}, {{amount}}, {{period}}, {{invoiceNumber}}",
  SUBSCRIPTION_EXPIRING: "{{userName}}, {{planName}}, {{expiresAt}}",
  PAYMENT_FAILED: "{{userName}}, {{planName}}",
  PASSWORD_RESET: "{{resetLink}}",
  EMAIL_VERIFICATION: "{{verifyLink}}",
};

export default function AdminEmailPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [tab, setTab] = useState<"logs" | "templates">("logs");
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editType, setEditType] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ subject: string; html: string; isActive: boolean }>({ subject: "", html: "", isActive: true });
  const [savingTemplate, setSavingTemplate] = useState(false);

  const fetchLogs = async () => {
    const res = await fetch(`/api/admin/email?page=${page}&limit=20`);
    const data = await res.json();
    setLogs(data.logs || []);
    setTotal(data.total || 0);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    const res = await fetch("/api/admin/email-templates");
    setTemplates(await res.json());
  };

  useEffect(() => { fetchLogs(); }, [page]);
  useEffect(() => { if (tab === "templates") fetchTemplates(); }, [tab]);

  const handleSaveTemplate = async () => {
    if (!editType) return;
    setSavingTemplate(true);
    await fetch("/api/admin/email-templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: editType, ...editForm }),
    });
    setSavingTemplate(false);
    setEditType(null);
    fetchTemplates();
  };

  const handleVerifySmtp = async () => {
    setSmtpStatus(null);
    const res = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify" }),
    });
    setSmtpStatus(await res.json());
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setSending(true);
    await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", to: testEmail }),
    });
    setSending(false);
    setTestEmail("");
    setTimeout(fetchLogs, 1000);
  };

  const totalPages = Math.ceil(total / 20);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)] mb-1">Email</h1>
      <p className="text-sm text-text-secondary mb-6">Логи отправки, шаблоны и SMTP-конфигурация</p>

      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab("logs")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tab === "logs" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}>Логи</button>
        <button onClick={() => setTab("templates")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${tab === "templates" ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}><NotePencil className="h-3 w-3 inline mr-1" weight="duotone" />Шаблоны</button>
      </div>

      {tab === "templates" && (
        <div className="space-y-3">
          {editType ? (
            <div className="bg-surface border border-accent/30 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">{TYPE_LABELS[editType] || editType}</h3>
                <div className="flex items-center gap-2">
                  <Button variant="gradient" size="sm" onClick={handleSaveTemplate} isLoading={savingTemplate}>
                    <FloppyDisk className="h-3.5 w-3.5" weight="duotone" /> Сохранить
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditType(null)}>Отмена</Button>
                </div>
              </div>
              <p className="text-xs text-text-secondary mb-3">Переменные: <code className="text-accent">{TYPE_VARS[editType] || ""}</code></p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-text-secondary block mb-1">Тема письма</label>
                  <input
                    value={editForm.subject}
                    onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary block mb-1">HTML-содержимое</label>
                  <textarea
                    value={editForm.html}
                    onChange={(e) => setEditForm({ ...editForm, html: e.target.value })}
                    className="w-full h-64 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary font-mono focus:outline-none focus:border-accent resize-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} className="rounded" />
                  Активный (перезаписывает стандартный шаблон)
                </label>
              </div>
            </div>
          ) : (
            templates.map((t) => (
              <div key={t.type} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${t.isActive && t.html ? "bg-success" : "bg-text-muted"}`} />
                  <div>
                    <span className="text-sm font-medium text-text-primary">{TYPE_LABELS[t.type] || t.type}</span>
                    {t.subject && <span className="text-xs text-text-secondary ml-2">&middot; {t.subject}</span>}
                    {!t.html && <span className="text-xs text-text-secondary ml-2">(стандартный)</span>}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => { setEditType(t.type); setEditForm({ subject: t.subject, html: t.html, isActive: t.isActive }); }}>
                  <NotePencil className="h-3.5 w-3.5" weight="duotone" /> Изменить
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "logs" && <>
      {/* SMTP Check & Test */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Button variant="secondary" size="sm" onClick={handleVerifySmtp}>
              <ArrowsClockwise className="h-3.5 w-3.5" weight="duotone" />
              Проверить SMTP
            </Button>
          </div>
          {smtpStatus && (
            <div className="flex items-center gap-2">
              {smtpStatus.ok ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success" weight="duotone" />
                  <span className="text-sm text-success">SMTP работает</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-error" weight="duotone" />
                  <span className="text-sm text-error">{smtpStatus.error || "Ошибка SMTP"}</span>
                </>
              )}
            </div>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <input
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="h-9 w-64 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <Button variant="gradient" size="sm" onClick={handleTestEmail} isLoading={sending}>
              <PaperPlaneRight className="h-3.5 w-3.5" weight="duotone" />
              Тест
            </Button>
          </div>
        </div>
      </div>

      {/* Email logs */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Envelope className="h-4 w-4 text-text-secondary" weight="duotone" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary">{log.to}</span>
                      <Badge variant={log.status === "SENT" ? "accent" : "default"}>
                        {log.status}
                      </Badge>
                      <Badge variant="default">{log.type}</Badge>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {log.subject}
                      {log.error && <span className="text-error ml-2">{log.error}</span>}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-text-secondary">{formatDate(log.createdAt)}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-sm text-text-secondary text-center py-8">Нет записей</p>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                Назад
              </Button>
              <span className="text-sm text-text-secondary">{page} / {totalPages}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                Далее
              </Button>
            </div>
          )}
        </>
      )}
      </>}
    </div>
  );
}
