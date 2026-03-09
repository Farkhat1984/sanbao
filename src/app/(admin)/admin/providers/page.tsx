"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Power, PowerOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminCreatePanel } from "@/components/admin/AdminCreatePanel";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { api } from "@/lib/api-client";

interface Provider {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  priority: number;
  apiFormat: string;
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
    apiFormat: "OPENAI_COMPAT",
  });

  const fetchProviders = async () => {
    const data = await api.get<Provider[]>("/api/admin/providers");
    setProviders(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleCreate = async () => {
    try {
      await api.post("/api/admin/providers", newProvider);
      setNewProvider({ name: "", slug: "", baseUrl: "", apiKey: "", priority: 0, apiFormat: "OPENAI_COMPAT" });
      setAdding(false);
      fetchProviders();
    } catch { /* validation error — stay on form */ }
  };

  const handleUpdate = async (id: string, data: Partial<Provider>) => {
    await api.put(`/api/admin/providers/${id}`, data);
    fetchProviders();
  };

  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; latency?: number; error?: string; modelCount?: number }>>({});

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const data = await api.post<{ success: boolean; latency?: number; error?: string; modelCount?: number }>("/api/admin/providers/test", { providerId: id });
      setTestResult((prev) => ({ ...prev, [id]: data }));
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: { success: false, error: "Network error" } }));
    }
    setTesting(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить провайдера и все его модели?")) return;
    await api.delete(`/api/admin/providers/${id}`);
    fetchProviders();
  };

  if (loading) {
    return <AdminListSkeleton rows={3} height="h-24" />;
  }

  return (
    <div>
      <AdminPageHeader
        title="AI-провайдеры"
        subtitle="Управление подключениями к AI API"
        action={
          <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        }
      />

      <AdminCreatePanel isOpen={adding} title="Новый провайдер">
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
          <select
            value={newProvider.apiFormat}
            onChange={(e) => setNewProvider({ ...newProvider, apiFormat: e.target.value })}
            className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="OPENAI_COMPAT">OpenAI Compatible</option>
            <option value="AI_SDK_OPENAI">AI SDK — OpenAI</option>
          </select>
          <Button variant="gradient" size="sm" onClick={handleCreate}>
            <Save className="h-3.5 w-3.5" />
            Создать
          </Button>
        </div>
      </AdminCreatePanel>

      <div className="space-y-3">
        {providers.map((p) => (
          <div key={p.id} className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${p.isActive ? "bg-success" : "bg-text-muted"}`} />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{p.name}</h3>
                  <p className="text-xs text-text-secondary">{p.slug} &middot; {p._count?.models || 0} моделей</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary font-mono">{p.apiKey}</span>
                <span className="text-xs text-text-secondary">Приоритет: {p.priority}</span>
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
                <AdminDeleteButton onClick={() => handleDelete(p.id)} />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <p className="text-xs text-text-secondary">
                  <span className="text-text-secondary">Base URL:</span> {p.baseUrl}
                </p>
                <select
                  value={p.apiFormat}
                  onChange={(e) => handleUpdate(p.id, { apiFormat: e.target.value } as Partial<Provider>)}
                  className="h-7 px-2 rounded-md bg-surface-alt border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="OPENAI_COMPAT">OpenAI Compatible</option>
                  <option value="AI_SDK_OPENAI">AI SDK — OpenAI</option>
                    </select>
              </div>
              {testResult[p.id] && (
                <div className="flex items-center gap-2">
                  {testResult[p.id].success ? (
                    <>
                      <Badge variant="default">OK</Badge>
                      <span className="text-xs text-success">{testResult[p.id].latency}ms</span>
                      {testResult[p.id].modelCount !== undefined && (
                        <span className="text-xs text-text-secondary">{testResult[p.id].modelCount} моделей</span>
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
        {providers.length === 0 && <AdminEmptyState message="Провайдеры не добавлены" />}
      </div>
    </div>
  );
}
