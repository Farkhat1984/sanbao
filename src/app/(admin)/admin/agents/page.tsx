"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2, Power, PowerOff, GripVertical, Eye, X, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface SystemAgent {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  icon: string;
  iconColor: string;
  model: string;
  isActive: boolean;
  sortOrder: number;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<SystemAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SystemAgent>>({});
  const [newAgent, setNewAgent] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    icon: "Bot",
    iconColor: "#4F6EF7",
    model: "default",
  });

  const fetchAgents = async () => {
    const res = await fetch("/api/admin/system-agents");
    setAgents(await res.json());
    setLoading(false);
  };

  const [previewAgent, setPreviewAgent] = useState<SystemAgent | null>(null);
  const [previewInput, setPreviewInput] = useState("");
  const [previewMessages, setPreviewMessages] = useState<{ role: string; content: string }[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreviewSend = async () => {
    if (!previewInput.trim() || !previewAgent || previewLoading) return;
    const userMsg = previewInput.trim();
    setPreviewInput("");
    setPreviewMessages((m) => [...m, { role: "user", content: userMsg }]);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/system-agents/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: previewAgent.systemPrompt, message: userMsg }),
      });
      const data = await res.json();
      setPreviewMessages((m) => [...m, { role: "assistant", content: data.reply || data.error || "Нет ответа" }]);
    } catch {
      setPreviewMessages((m) => [...m, { role: "assistant", content: "Ошибка при отправке" }]);
    }
    setPreviewLoading(false);
  };

  const openPreview = (agent: SystemAgent) => {
    setPreviewAgent(agent);
    setPreviewMessages([]);
    setPreviewInput("");
  };

  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => { fetchAgents(); }, []);

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const items = [...agents];
    const fromIdx = items.findIndex((a) => a.id === dragId);
    const toIdx = items.findIndex((a) => a.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); return; }
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    // Update sortOrder locally
    const reordered = items.map((a, i) => ({ ...a, sortOrder: i }));
    setAgents(reordered);
    setDragId(null);
    // Persist sort order to server
    await fetch("/api/admin/system-agents/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map((a) => a.id) }),
    });
  };

  const handleCreate = async () => {
    const res = await fetch("/api/admin/system-agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAgent),
    });
    if (res.ok) {
      setAdding(false);
      setNewAgent({ name: "", description: "", systemPrompt: "", icon: "Bot", iconColor: "#4F6EF7", model: "default" });
      fetchAgents();
    }
  };

  const handleUpdate = async (id: string, data: Partial<SystemAgent>) => {
    await fetch(`/api/admin/system-agents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditId(null);
    fetchAgents();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить системного агента?")) return;
    await fetch(`/api/admin/system-agents/${id}`, { method: "DELETE" });
    fetchAgents();
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
          <h1 className="text-xl font-bold text-text-primary">Системные агенты</h1>
          <p className="text-sm text-text-muted mt-1">Управление встроенными агентами</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Новый агент</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <input placeholder="Имя" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Иконка (Bot, Scale...)" value={newAgent.icon} onChange={(e) => setNewAgent({ ...newAgent, icon: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Цвет (#4F6EF7)" value={newAgent.iconColor} onChange={(e) => setNewAgent({ ...newAgent, iconColor: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          </div>
          <textarea placeholder="Описание" value={newAgent.description} onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })} className="w-full h-16 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-3" />
          <textarea placeholder="Системный промпт" value={newAgent.systemPrompt} onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })} className="w-full h-32 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-3" />
          <Button variant="gradient" size="sm" onClick={handleCreate}>
            <Save className="h-3.5 w-3.5" /> Создать
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {agents.map((a) => (
          <div
            key={a.id}
            className={`bg-surface border rounded-2xl p-5 transition-colors ${dragId === a.id ? "border-accent/50 opacity-50" : "border-border"}`}
            draggable
            onDragStart={() => handleDragStart(a.id)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(a.id)}
            onDragEnd={() => setDragId(null)}
          >
            {editId === a.id ? (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Имя</label>
                    <input value={editForm.name ?? a.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Иконка</label>
                    <input value={editForm.icon ?? a.icon} onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Цвет</label>
                    <input value={editForm.iconColor ?? a.iconColor} onChange={(e) => setEditForm({ ...editForm, iconColor: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                  </div>
                </div>
                <textarea value={editForm.description ?? a.description ?? ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Описание" className="w-full h-16 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent resize-none mb-3" />
                <textarea value={editForm.systemPrompt ?? a.systemPrompt} onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })} placeholder="Системный промпт" className="w-full h-32 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent resize-none mb-3" />
                <div className="flex gap-2">
                  <Button variant="gradient" size="sm" onClick={() => handleUpdate(a.id, editForm)}><Save className="h-3.5 w-3.5" /> Сохранить</Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditId(null)}>Отмена</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-text-muted cursor-grab active:cursor-grabbing" />
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: a.iconColor }}>{a.icon.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{a.name}</span>
                      <span className={`h-2 w-2 rounded-full ${a.isActive ? "bg-success" : "bg-text-muted"}`} />
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{a.description || "Без описания"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="secondary" size="sm" onClick={() => handleUpdate(a.id, { isActive: !a.isActive })}>
                    {a.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openPreview(a)}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button variant="secondary" size="sm" onClick={() => { setEditId(a.id); setEditForm({}); }}>Изменить</Button>
                  <button onClick={() => handleDelete(a.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {agents.length === 0 && <p className="text-sm text-text-muted text-center py-8">Системные агенты не найдены</p>}
      </div>

      {/* Preview modal */}
      {previewAgent && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreviewAgent(null)}>
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: previewAgent.iconColor }}>{previewAgent.icon.charAt(0)}</div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{previewAgent.name}</h3>
                  <p className="text-xs text-text-muted">{previewAgent.description || "Предпросмотр агента"}</p>
                </div>
              </div>
              <button onClick={() => setPreviewAgent(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {previewMessages.length === 0 && (
                <p className="text-xs text-text-muted text-center py-8">Напишите сообщение, чтобы протестировать агента</p>
              )}
              {previewMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${m.role === "user" ? "bg-accent text-white" : "bg-surface-alt text-text-primary border border-border"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {previewLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface-alt border border-border rounded-xl px-3 py-2 text-sm text-text-muted animate-pulse">Думает...</div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border flex gap-2">
              <input
                value={previewInput}
                onChange={(e) => setPreviewInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePreviewSend()}
                placeholder="Введите сообщение..."
                className="flex-1 h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <Button variant="gradient" size="sm" onClick={handlePreviewSend} isLoading={previewLoading}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
