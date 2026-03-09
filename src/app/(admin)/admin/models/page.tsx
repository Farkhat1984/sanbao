"use client";

import { useState, useEffect } from "react";
import { Plus, Star, StarOff, Brain, Grid3X3 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TabFilter } from "@/components/ui/TabFilter";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminCreatePanel } from "@/components/admin/AdminCreatePanel";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { ModelForm, MODEL_CATEGORIES, MODEL_CATEGORY_LABELS } from "@/components/admin/ModelForm";
import type { ModelFormData, ModelFormProvider } from "@/components/admin/ModelForm";

interface Model {
  id: string;
  modelId: string;
  displayName: string;
  category: string;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  contextWindow: number | null;
  costPer1kInput: number;
  costPer1kOutput: number;
  pricePer1kInput: number;
  pricePer1kOutput: number;
  supportsThinking: boolean;
  maxThinkingTokens: number | null;
  isActive: boolean;
  isDefault: boolean;
  provider: { id: string; name: string; slug: string };
  _count?: { planModels: number };
}

export default function AdminModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<ModelFormProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchData = async () => {
    const [modelsRes, providersRes] = await Promise.all([
      fetch(`/api/admin/models${filter ? `?category=${filter}` : ""}`),
      fetch("/api/admin/providers"),
    ]);
    setModels(await modelsRes.json());
    setProviders(await providersRes.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const handleCreate = async (data: ModelFormData) => {
    const res = await fetch("/api/admin/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setAdding(false);
      fetchData();
    }
  };

  const handleUpdate = async (id: string, data: Partial<Model> | ModelFormData) => {
    await fetch(`/api/admin/models/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditId(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить модель?")) return;
    await fetch(`/api/admin/models/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading) {
    return <AdminListSkeleton rows={4} />;
  }

  const categoryOptions = MODEL_CATEGORIES.map((cat) => ({
    value: cat,
    label: MODEL_CATEGORY_LABELS[cat],
  }));

  return (
    <div>
      <AdminPageHeader
        title="AI-модели"
        subtitle="Настройки моделей, температура, токены, стоимость"
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/models/matrix">
              <Button variant="secondary" size="sm"><Grid3X3 className="h-4 w-4" /> Матрица планов</Button>
            </Link>
            <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
              <Plus className="h-4 w-4" /> Добавить
            </Button>
          </div>
        }
      />

      {/* Category filter */}
      <div className="mb-4">
        <TabFilter options={categoryOptions} value={filter} onChange={setFilter} />
      </div>

      {/* Add form */}
      <AdminCreatePanel isOpen={adding}>
        <ModelForm
          mode="create"
          providers={providers}
          onSubmit={handleCreate}
        />
      </AdminCreatePanel>

      {/* Models list */}
      <div className="space-y-2">
        {models.map((m) => (
          <div key={m.id} className="bg-surface border border-border rounded-2xl p-4">
            {editId === m.id ? (
              <ModelForm
                mode="edit"
                initialValues={{
                  displayName: m.displayName,
                  temperature: m.temperature ?? 0,
                  topP: m.topP ?? 0,
                  maxTokens: m.maxTokens ?? 0,
                  contextWindow: m.contextWindow ?? 0,
                  costPer1kInput: m.costPer1kInput,
                  costPer1kOutput: m.costPer1kOutput,
                  pricePer1kInput: m.pricePer1kInput,
                  pricePer1kOutput: m.pricePer1kOutput,
                  supportsThinking: m.supportsThinking,
                  maxThinkingTokens: m.maxThinkingTokens ?? 0,
                }}
                onSubmit={(data) => handleUpdate(m.id, data)}
                onCancel={() => setEditId(null)}
              />
            ) : (
              /* View mode */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${m.isActive ? "bg-success" : "bg-text-muted"}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{m.displayName}</span>
                      <Badge variant="default">{MODEL_CATEGORY_LABELS[m.category] || m.category}</Badge>
                      {m.supportsThinking && <Badge variant="default"><Brain className="h-3 w-3 inline" /> Thinking</Badge>}
                      {m.isDefault && <Badge variant="accent">По умолчанию</Badge>}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {m.provider.name} &middot; <span className="font-mono">{m.modelId}</span>
                      {m.temperature !== null && <> &middot; temp: {m.temperature}</>}
                      {m.maxTokens !== null && <> &middot; max: {m.maxTokens.toLocaleString()}</>}
                      {m.contextWindow !== null && <> &middot; ctx: {m.contextWindow.toLocaleString()}</>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUpdate(m.id, { isDefault: !m.isDefault })}
                  >
                    {m.isDefault ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditId(m.id)}>
                    Изменить
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUpdate(m.id, { isActive: !m.isActive })}
                  >
                    {m.isActive ? "Откл." : "Вкл."}
                  </Button>
                  <AdminDeleteButton onClick={() => handleDelete(m.id)} />
                </div>
              </div>
            )}
          </div>
        ))}
        {models.length === 0 && <AdminEmptyState message="Модели не найдены" />}
      </div>
    </div>
  );
}
