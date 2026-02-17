"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2, Star, StarOff, Brain, Grid3X3 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DEFAULT_TEMPERATURE_PREVIEW, DEFAULT_MAX_TOKENS, DEFAULT_CONTEXT_WINDOW } from "@/lib/constants";

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

interface Provider {
  id: string;
  name: string;
  slug: string;
}

const CATEGORIES = ["TEXT", "IMAGE", "VOICE", "VIDEO", "CODE", "EMBEDDING"];
const CATEGORY_LABELS: Record<string, string> = {
  TEXT: "Текст",
  IMAGE: "Изображения",
  VOICE: "Голос",
  VIDEO: "Видео",
  CODE: "Код",
  EMBEDDING: "Эмбеддинги",
};

export default function AdminModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Model>>({});
  const [newModel, setNewModel] = useState({
    providerId: "",
    modelId: "",
    displayName: "",
    category: "TEXT",
    temperature: DEFAULT_TEMPERATURE_PREVIEW,
    topP: 1,
    maxTokens: DEFAULT_MAX_TOKENS,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    pricePer1kInput: 0,
    pricePer1kOutput: 0,
    supportsThinking: false,
    maxThinkingTokens: 0,
  });

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

  const handleCreate = async () => {
    const res = await fetch("/api/admin/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newModel),
    });
    if (res.ok) {
      setAdding(false);
      setNewModel({ providerId: "", modelId: "", displayName: "", category: "TEXT", temperature: DEFAULT_TEMPERATURE_PREVIEW, topP: 1, maxTokens: DEFAULT_MAX_TOKENS, contextWindow: DEFAULT_CONTEXT_WINDOW, costPer1kInput: 0, costPer1kOutput: 0, pricePer1kInput: 0, pricePer1kOutput: 0, supportsThinking: false, maxThinkingTokens: 0 });
      fetchData();
    }
  };

  const handleUpdate = async (id: string, data: Partial<Model>) => {
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
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">AI-модели</h1>
          <p className="text-sm text-text-muted mt-1">Настройки моделей, температура, токены, стоимость</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/models/matrix">
            <Button variant="secondary" size="sm"><Grid3X3 className="h-4 w-4" /> Матрица планов</Button>
          </Link>
          <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
            <Plus className="h-4 w-4" /> Добавить
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 mb-4 flex-wrap">
        <button
          onClick={() => setFilter("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${!filter ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}
        >
          Все
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${filter === cat ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Новая модель</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select
              value={newModel.providerId}
              onChange={(e) => setNewModel({ ...newModel, providerId: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">Провайдер...</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              placeholder="ID модели у провайдера"
              value={newModel.modelId}
              onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Отображаемое имя"
              value={newModel.displayName}
              onChange={(e) => setNewModel({ ...newModel, displayName: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <select
              value={newModel.category}
              onChange={(e) => setNewModel({ ...newModel, category: e.target.value })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <input
              placeholder="Temperature"
              type="number"
              step="0.1"
              value={newModel.temperature}
              onChange={(e) => setNewModel({ ...newModel, temperature: parseFloat(e.target.value) || 0 })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Top P"
              type="number"
              step="0.1"
              value={newModel.topP}
              onChange={(e) => setNewModel({ ...newModel, topP: parseFloat(e.target.value) || 0 })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Max Tokens"
              type="number"
              value={newModel.maxTokens}
              onChange={(e) => setNewModel({ ...newModel, maxTokens: parseInt(e.target.value) || 0 })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Context Window"
              type="number"
              value={newModel.contextWindow}
              onChange={(e) => setNewModel({ ...newModel, contextWindow: parseInt(e.target.value) || 0 })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Себест./1k вх"
              type="number"
              step="0.001"
              value={newModel.costPer1kInput}
              onChange={(e) => setNewModel({ ...newModel, costPer1kInput: parseFloat(e.target.value) || 0 })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Себест./1k вых"
              type="number"
              step="0.001"
              value={newModel.costPer1kOutput}
              onChange={(e) => setNewModel({ ...newModel, costPer1kOutput: parseFloat(e.target.value) || 0 })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Продажа/1k вх"
              type="number"
              step="0.001"
              value={newModel.pricePer1kInput}
              onChange={(e) => setNewModel({ ...newModel, pricePer1kInput: parseFloat(e.target.value) || 0 })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Продажа/1k вых"
              type="number"
              step="0.001"
              value={newModel.pricePer1kOutput}
              onChange={(e) => setNewModel({ ...newModel, pricePer1kOutput: parseFloat(e.target.value) || 0 })}
              className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={newModel.supportsThinking}
                onChange={(e) => setNewModel({ ...newModel, supportsThinking: e.target.checked })}
                className="rounded"
              />
              Поддержка Thinking
            </label>
            {newModel.supportsThinking && (
              <input
                placeholder="Max Thinking Tokens"
                type="number"
                value={newModel.maxThinkingTokens}
                onChange={(e) => setNewModel({ ...newModel, maxThinkingTokens: parseInt(e.target.value) || 0 })}
                className="h-9 w-48 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            )}
          </div>
          <div className="mt-3">
            <Button variant="gradient" size="sm" onClick={handleCreate}>
              <Save className="h-3.5 w-3.5" />
              Создать
            </Button>
          </div>
        </div>
      )}

      {/* Models list */}
      <div className="space-y-2">
        {models.map((m) => (
          <div key={m.id} className="bg-surface border border-border rounded-2xl p-4">
            {editId === m.id ? (
              /* Edit mode */
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Название</label>
                    <input
                      value={editForm.displayName ?? m.displayName}
                      onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                      className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.temperature ?? m.temperature ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, temperature: parseFloat(e.target.value) || null })}
                      className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Top P</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.topP ?? m.topP ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, topP: parseFloat(e.target.value) || null })}
                      className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Max Tokens</label>
                    <input
                      type="number"
                      value={editForm.maxTokens ?? m.maxTokens ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, maxTokens: parseInt(e.target.value) || null })}
                      className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Context Window</label>
                    <input
                      type="number"
                      value={editForm.contextWindow ?? m.contextWindow ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, contextWindow: parseInt(e.target.value) || null })}
                      className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">$/1k input</label>
                    <input
                      type="number"
                      step="0.001"
                      value={editForm.costPer1kInput ?? m.costPer1kInput}
                      onChange={(e) => setEditForm({ ...editForm, costPer1kInput: parseFloat(e.target.value) || 0 })}
                      className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">$/1k output</label>
                    <input
                      type="number"
                      step="0.001"
                      value={editForm.costPer1kOutput ?? m.costPer1kOutput}
                      onChange={(e) => setEditForm({ ...editForm, costPer1kOutput: parseFloat(e.target.value) || 0 })}
                      className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Продажа/1k вх</label>
                    <input
                      type="number"
                      step="0.001"
                      value={editForm.pricePer1kInput ?? m.pricePer1kInput}
                      onChange={(e) => setEditForm({ ...editForm, pricePer1kInput: parseFloat(e.target.value) || 0 })}
                      className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Продажа/1k вых</label>
                    <input
                      type="number"
                      step="0.001"
                      value={editForm.pricePer1kOutput ?? m.pricePer1kOutput}
                      onChange={(e) => setEditForm({ ...editForm, pricePer1kOutput: parseFloat(e.target.value) || 0 })}
                      className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.supportsThinking ?? m.supportsThinking}
                      onChange={(e) => setEditForm({ ...editForm, supportsThinking: e.target.checked })}
                      className="rounded"
                    />
                    Поддержка Thinking
                  </label>
                  {(editForm.supportsThinking ?? m.supportsThinking) && (
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Max Thinking Tokens</label>
                      <input
                        type="number"
                        value={editForm.maxThinkingTokens ?? m.maxThinkingTokens ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, maxThinkingTokens: parseInt(e.target.value) || null })}
                        className="w-40 h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="gradient" size="sm" onClick={() => handleUpdate(m.id, editForm)}>
                    <Save className="h-3.5 w-3.5" /> Сохранить
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditId(null)}>Отмена</Button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${m.isActive ? "bg-success" : "bg-text-muted"}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{m.displayName}</span>
                      <Badge variant="default">{CATEGORY_LABELS[m.category] || m.category}</Badge>
                      {m.supportsThinking && <Badge variant="default"><Brain className="h-3 w-3 inline" /> Thinking</Badge>}
                      {m.isDefault && <Badge variant="accent">По умолчанию</Badge>}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
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
                  <Button variant="secondary" size="sm" onClick={() => { setEditId(m.id); setEditForm({}); }}>
                    Изменить
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUpdate(m.id, { isActive: !m.isActive })}
                  >
                    {m.isActive ? "Откл." : "Вкл."}
                  </Button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {models.length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">Модели не найдены</p>
        )}
      </div>
    </div>
  );
}
