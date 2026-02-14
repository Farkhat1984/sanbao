"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2, Power, PowerOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface Provider {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  priority: number;
  _count?: { models: number };
}

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: "",
    slug: "",
    baseUrl: "",
    apiKey: "",
    priority: 0,
  });

  const fetchProviders = async () => {
    const res = await fetch("/api/admin/providers");
    const data = await res.json();
    setProviders(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProvider),
    });
    if (res.ok) {
      setNewProvider({ name: "", slug: "", baseUrl: "", apiKey: "", priority: 0 });
      setAdding(false);
      fetchProviders();
    }
  };

  const handleUpdate = async (id: string, data: Partial<Provider>) => {
    await fetch(`/api/admin/providers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchProviders();
  };

  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; latency?: number; error?: string; modelCount?: number }>>({});

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch("/api/admin/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: id }),
      });
      const data = await res.json();
      setTestResult((prev) => ({ ...prev, [id]: data }));
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: { success: false, error: "Network error" } }));
    }
    setTesting(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить провайдера и все его модели?")) return;
    await fetch(`/api/admin/providers/${id}`, { method: "DELETE" });
    fetchProviders();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">AI-провайдеры</h1>
          <p className="text-sm text-text-muted mt-1">Управление подключениями к AI API</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Новый провайдер</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input
              placeholder="Название (OpenAI)"
              value={newProvider.name}
              onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Slug (openai)"
              value={newProvider.slug}
              onChange={(e) => setNewProvider({ ...newProvider, slug: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Base URL"
              value={newProvider.baseUrl}
              onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <input
              placeholder="API Key"
              type="password"
              value={newProvider.apiKey}
              onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Приоритет (0-100)"
              type="number"
              value={newProvider.priority}
              onChange={(e) => setNewProvider({ ...newProvider, priority: parseInt(e.target.value) || 0 })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <Button variant="gradient" size="sm" onClick={handleCreate}>
              <Save className="h-3.5 w-3.5" />
              Создать
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {providers.map((p) => (
          <div key={p.id} className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${p.isActive ? "bg-success" : "bg-text-muted"}`} />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{p.name}</h3>
                  <p className="text-xs text-text-muted">{p.slug} &middot; {p._count?.models || 0} моделей</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-mono">{p.apiKey}</span>
                <span className="text-xs text-text-muted">Приоритет: {p.priority}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleTest(p.id)}
                  isLoading={testing === p.id}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Тест
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUpdate(p.id, { isActive: !p.isActive })}
                >
                  {p.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  {p.isActive ? "Откл." : "Вкл."}
                </Button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-text-muted">
                <span className="text-text-secondary">Base URL:</span> {p.baseUrl}
              </p>
              {testResult[p.id] && (
                <div className="flex items-center gap-2">
                  {testResult[p.id].success ? (
                    <>
                      <Badge variant="default">OK</Badge>
                      <span className="text-xs text-success">{testResult[p.id].latency}ms</span>
                      {testResult[p.id].modelCount !== undefined && (
                        <span className="text-xs text-text-muted">{testResult[p.id].modelCount} моделей</span>
                      )}
                    </>
                  ) : (
                    <>
                      <Badge variant="default">Ошибка</Badge>
                      <span className="text-xs text-error">{testResult[p.id].error?.slice(0, 60)}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {providers.length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">Провайдеры не добавлены</p>
        )}
      </div>
    </div>
  );
}
