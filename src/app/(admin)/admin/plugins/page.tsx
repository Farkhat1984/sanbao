"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2, Power, PowerOff, Puzzle, Wrench, FileText, Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";

interface Plugin {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
  version: string;
  isActive: boolean;
  sortOrder: number;
  tools: Array<{ tool: { id: string; name: string; icon?: string } }>;
  skills: Array<{ skill: { id: string; name: string; icon?: string } }>;
  mcpServers: Array<{ mcpServer: { id: string; name: string; status?: string } }>;
  agents: Array<{ agent: { id: string; name: string } }>;
}

export default function AdminPluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Plugin>>({});
  const [newPlugin, setNewPlugin] = useState({
    name: "",
    description: "",
    icon: "Puzzle",
    iconColor: "#4F6EF7",
    version: "1.0.0",
  });

  const fetchPlugins = async () => {
    const res = await fetch("/api/admin/plugins");
    if (res.ok) setPlugins(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchPlugins(); }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/admin/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPlugin),
    });
    if (res.ok) {
      setAdding(false);
      setNewPlugin({ name: "", description: "", icon: "Puzzle", iconColor: "#4F6EF7", version: "1.0.0" });
      fetchPlugins();
    }
  };

  const handleUpdate = async (id: string) => {
    const data: Record<string, unknown> = {};
    if (editForm.name !== undefined) data.name = editForm.name;
    if (editForm.description !== undefined) data.description = editForm.description;
    if (editForm.icon !== undefined) data.icon = editForm.icon;
    if (editForm.iconColor !== undefined) data.iconColor = editForm.iconColor;
    if (editForm.version !== undefined) data.version = editForm.version;

    await fetch(`/api/admin/plugins/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditId(null);
    fetchPlugins();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/plugins/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchPlugins();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить плагин?")) return;
    await fetch(`/api/admin/plugins/${id}`, { method: "DELETE" });
    fetchPlugins();
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
          <h1 className="text-xl font-bold text-text-primary">Плагины</h1>
          <p className="text-sm text-text-muted mt-1">Управление плагинами ({plugins.length})</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Новый плагин</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <input placeholder="Название" value={newPlugin.name} onChange={(e) => setNewPlugin({ ...newPlugin, name: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Иконка (Puzzle...)" value={newPlugin.icon} onChange={(e) => setNewPlugin({ ...newPlugin, icon: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Цвет (#4F6EF7)" value={newPlugin.iconColor} onChange={(e) => setNewPlugin({ ...newPlugin, iconColor: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          </div>
          <textarea placeholder="Описание" value={newPlugin.description} onChange={(e) => setNewPlugin({ ...newPlugin, description: e.target.value })} className="w-full h-16 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-3" />
          <Button variant="gradient" size="sm" onClick={handleCreate} disabled={!newPlugin.name.trim()}>
            <Save className="h-3.5 w-3.5" /> Создать
          </Button>
        </div>
      )}

      {/* Plugins list */}
      <div className="space-y-3">
        {plugins.map((plugin) => {
          const Icon = ICON_MAP[plugin.icon] || Puzzle;

          return (
            <div key={plugin.id} className="bg-surface border border-border rounded-2xl p-5">
              {editId === plugin.id ? (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Название</label>
                      <input value={editForm.name ?? plugin.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Иконка</label>
                      <input value={editForm.icon ?? plugin.icon} onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted block mb-1">Версия</label>
                      <input value={editForm.version ?? plugin.version} onChange={(e) => setEditForm({ ...editForm, version: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                    </div>
                  </div>
                  <textarea value={editForm.description ?? plugin.description ?? ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Описание" className="w-full h-16 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent resize-none mb-3" />
                  <div className="flex gap-2">
                    <Button variant="gradient" size="sm" onClick={() => handleUpdate(plugin.id)}><Save className="h-3.5 w-3.5" /> Сохранить</Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditId(null)}>Отмена</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${plugin.iconColor}15` }}>
                        <Icon className="h-4 w-4" style={{ color: plugin.iconColor }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary">{plugin.name}</span>
                          <span className={`h-2 w-2 rounded-full ${plugin.isActive ? "bg-success" : "bg-text-muted"}`} />
                          <span className="text-[10px] text-text-muted">v{plugin.version}</span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">{plugin.description || "Без описания"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="secondary" size="sm" onClick={() => handleToggle(plugin.id, plugin.isActive)}>
                        {plugin.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => { setEditId(plugin.id); setEditForm({}); }}>Изменить</Button>
                      <button onClick={() => handleDelete(plugin.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Attached items */}
                  <div className="flex flex-wrap gap-2">
                    {plugin.tools?.map((t) => (
                      <span key={t.tool.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-[10px]">
                        <Wrench className="h-2.5 w-2.5" />
                        {t.tool.name}
                      </span>
                    ))}
                    {plugin.skills?.map((s) => (
                      <span key={s.skill.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 text-[10px]">
                        <FileText className="h-2.5 w-2.5" />
                        {s.skill.name}
                      </span>
                    ))}
                    {plugin.mcpServers?.map((m) => (
                      <span key={m.mcpServer.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-[10px]">
                        <Globe className="h-2.5 w-2.5" />
                        {m.mcpServer.name}
                      </span>
                    ))}
                    {plugin.agents?.map((a) => (
                      <span key={a.agent.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 text-[10px]">
                        {a.agent.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {plugins.length === 0 && <p className="text-sm text-text-muted text-center py-8">Плагины не найдены</p>}
      </div>
    </div>
  );
}
