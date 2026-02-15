"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2, Power, PowerOff, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";

interface Tool {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
  type: string;
  config: Record<string, unknown>;
  inputSchema: Record<string, unknown> | null;
  isActive: boolean;
  sortOrder: number;
  agents: Array<{ agent: { id: string; name: string; isSystem?: boolean } }>;
}

export default function AdminToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Tool & { configJson: string }>>({});
  const [newTool, setNewTool] = useState({
    name: "",
    description: "",
    icon: "Wrench",
    iconColor: "#4F6EF7",
    type: "PROMPT_TEMPLATE",
    configJson: '{\n  "prompt": ""\n}',
  });

  const fetchTools = async () => {
    const res = await fetch("/api/admin/tools");
    if (res.ok) setTools(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchTools(); }, []);

  const [dragId, setDragId] = useState<string | null>(null);
  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const items = [...tools];
    const fromIdx = items.findIndex((t) => t.id === dragId);
    const toIdx = items.findIndex((t) => t.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); return; }
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    const reordered = items.map((t, i) => ({ ...t, sortOrder: i }));
    setTools(reordered);
    setDragId(null);
    // Persist sort order
    for (let i = 0; i < reordered.length; i++) {
      fetch(`/api/admin/tools/${reordered[i].id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: i }),
      }).catch(console.error);
    }
  };

  const handleCreate = async () => {
    let config = {};
    try { config = JSON.parse(newTool.configJson); } catch { return; }

    const res = await fetch("/api/admin/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newTool.name,
        description: newTool.description || null,
        icon: newTool.icon,
        iconColor: newTool.iconColor,
        type: newTool.type,
        config,
      }),
    });
    if (res.ok) {
      setAdding(false);
      setNewTool({ name: "", description: "", icon: "Wrench", iconColor: "#4F6EF7", type: "PROMPT_TEMPLATE", configJson: '{\n  "prompt": ""\n}' });
      fetchTools();
    }
  };

  const handleUpdate = async (id: string) => {
    const data: Record<string, unknown> = {};
    if (editForm.name !== undefined) data.name = editForm.name;
    if (editForm.description !== undefined) data.description = editForm.description;
    if (editForm.icon !== undefined) data.icon = editForm.icon;
    if (editForm.iconColor !== undefined) data.iconColor = editForm.iconColor;
    if (editForm.type !== undefined) data.type = editForm.type;
    if (editForm.configJson !== undefined) {
      try { data.config = JSON.parse(editForm.configJson); } catch { return; }
    }

    await fetch(`/api/admin/tools/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditId(null);
    fetchTools();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/tools/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchTools();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить инструмент?")) return;
    await fetch(`/api/admin/tools/${id}`, { method: "DELETE" });
    fetchTools();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Инструменты</h1>
          <p className="text-sm text-text-muted mt-1">Системные инструменты для агентов ({tools.length})</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Новый инструмент</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <input placeholder="Название" value={newTool.name} onChange={(e) => setNewTool({ ...newTool, name: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Иконка (Wrench, FileText...)" value={newTool.icon} onChange={(e) => setNewTool({ ...newTool, icon: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Цвет (#4F6EF7)" value={newTool.iconColor} onChange={(e) => setNewTool({ ...newTool, iconColor: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <select value={newTool.type} onChange={(e) => setNewTool({ ...newTool, type: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer">
              <option value="PROMPT_TEMPLATE">Промпт-шаблон</option>
              <option value="WEBHOOK">Вебхук</option>
              <option value="URL">URL</option>
              <option value="FUNCTION">Функция</option>
            </select>
          </div>
          <textarea placeholder="Описание" value={newTool.description} onChange={(e) => setNewTool({ ...newTool, description: e.target.value })} className="w-full h-16 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-3" />
          <label className="text-xs text-text-muted block mb-1">Config (JSON)</label>
          <textarea placeholder='{"prompt": "..."}' value={newTool.configJson} onChange={(e) => setNewTool({ ...newTool, configJson: e.target.value })} className="w-full h-32 px-3 py-2 rounded-lg bg-surface-alt border border-border text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-3" />
          <Button variant="gradient" size="sm" onClick={handleCreate} disabled={!newTool.name.trim()}>
            <Save className="h-3.5 w-3.5" /> Создать
          </Button>
        </div>
      )}

      {/* Tools list */}
      <div className="space-y-3">
        {tools.map((tool) => {
          const Icon = ICON_MAP[tool.icon] || ICON_MAP.Wrench;
          const agentNames = tool.agents?.map((a) => a.agent.name).join(", ") || "";

          return (
            <div
              key={tool.id}
              className={`bg-surface border rounded-2xl p-5 transition-colors ${dragId === tool.id ? "border-accent/50 opacity-50" : "border-border"}`}
              draggable
              onDragStart={() => handleDragStart(tool.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(tool.id)}
              onDragEnd={() => setDragId(null)}
            >
              {editId === tool.id ? (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Название</label>
                      <input value={editForm.name ?? tool.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Иконка</label>
                      <input value={editForm.icon ?? tool.icon} onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Цвет</label>
                      <input value={editForm.iconColor ?? tool.iconColor} onChange={(e) => setEditForm({ ...editForm, iconColor: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Тип</label>
                      <select value={editForm.type ?? tool.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer">
                        <option value="PROMPT_TEMPLATE">Промпт-шаблон</option>
                        <option value="WEBHOOK">Вебхук</option>
                        <option value="URL">URL</option>
                        <option value="FUNCTION">Функция</option>
                      </select>
                    </div>
                  </div>
                  <textarea value={editForm.description ?? tool.description ?? ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Описание" className="w-full h-16 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent resize-none mb-3" />
                  <label className="text-xs text-text-muted block mb-1">Config (JSON)</label>
                  <textarea
                    value={editForm.configJson ?? JSON.stringify(tool.config, null, 2)}
                    onChange={(e) => setEditForm({ ...editForm, configJson: e.target.value })}
                    className="w-full h-40 px-3 py-2 rounded-lg bg-surface-alt border border-border text-xs font-mono text-text-primary focus:outline-none focus:border-accent resize-none mb-3"
                  />
                  <div className="flex gap-2">
                    <Button variant="gradient" size="sm" onClick={() => handleUpdate(tool.id)}><Save className="h-3.5 w-3.5" /> Сохранить</Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditId(null)}>Отмена</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-text-muted cursor-grab active:cursor-grabbing" />
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tool.iconColor}15` }}>
                      <Icon className="h-4 w-4" style={{ color: tool.iconColor }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{tool.name}</span>
                        <span className={`h-2 w-2 rounded-full ${tool.isActive ? "bg-success" : "bg-text-muted"}`} />
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt text-text-muted">{tool.type}</span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{tool.description || "Без описания"}</p>
                      {agentNames && (
                        <p className="text-[10px] text-accent mt-0.5">Агенты: {agentNames}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="secondary" size="sm" onClick={() => handleToggle(tool.id, tool.isActive)}>
                      {tool.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => { setEditId(tool.id); setEditForm({}); }}>Изменить</Button>
                    <button onClick={() => handleDelete(tool.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {tools.length === 0 && <p className="text-sm text-text-muted text-center py-8">Инструменты не найдены</p>}
      </div>
    </div>
  );
}
