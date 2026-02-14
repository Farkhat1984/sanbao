"use client";

import { useState, useEffect } from "react";
import { Mail, CheckCircle, XCircle, Send, RefreshCw } from "lucide-react";
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

export default function AdminEmailPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ ok?: boolean; error?: string } | null>(null);

  const fetchLogs = async () => {
    const res = await fetch(`/api/admin/email?page=${page}&limit=20`);
    const data = await res.json();
    setLogs(data.logs || []);
    setTotal(data.total || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

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
      <h1 className="text-xl font-bold text-text-primary mb-1">Email</h1>
      <p className="text-sm text-text-muted mb-6">Логи отправки и SMTP-конфигурация</p>

      {/* SMTP Check & Test */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Button variant="secondary" size="sm" onClick={handleVerifySmtp}>
              <RefreshCw className="h-3.5 w-3.5" />
              Проверить SMTP
            </Button>
          </div>
          {smtpStatus && (
            <div className="flex items-center gap-2">
              {smtpStatus.ok ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">SMTP работает</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-error" />
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
              <Send className="h-3.5 w-3.5" />
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
                  <Mail className="h-4 w-4 text-text-muted" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary">{log.to}</span>
                      <Badge variant={log.status === "SENT" ? "accent" : "default"}>
                        {log.status}
                      </Badge>
                      <Badge variant="default">{log.type}</Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {log.subject}
                      {log.error && <span className="text-error ml-2">{log.error}</span>}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-text-muted">{formatDate(log.createdAt)}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-sm text-text-muted text-center py-8">Нет записей</p>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                Назад
              </Button>
              <span className="text-sm text-text-muted">{page} / {totalPages}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                Далее
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
