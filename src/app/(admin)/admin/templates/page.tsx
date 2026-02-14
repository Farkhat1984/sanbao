"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface Template {
  id: string;
  name: string;
  type: string;
  content: string;
  jurisdiction: string;
  isActive: boolean;
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Template>>({});
  const [newTpl, setNewTpl] = useState({ name: "", type: "CONTRACT", content: "", jurisdiction: "RU" });

  const fetchData = async () => {
    const res = await fetch("/api/admin/templates");
    setTemplates(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTpl),
    });
    if (res.ok) { setAdding(false); setNewTpl({ name: "", type: "CONTRACT", content: "", jurisdiction: "RU" }); fetchData(); }
  };

  const handleUpdate = async (id: string, data: Partial<Template>) => {
    await fetch(`/api/admin/templates/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setEditId(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить шаблон?")) return;
    await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-20" />)}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Шаблоны документов</h1>
          <p className="text-sm text-text-muted mt-1">Юридические шаблоны для генерации</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}><Plus className="h-4 w-4" /> Добавить</Button>
      </div>

      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input placeholder="Название" value={newTpl.name} onChange={(e) => setNewTpl({ ...newTpl, name: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <select value={newTpl.type} onChange={(e) => setNewTpl({ ...newTpl, type: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent">
              <option value="CONTRACT">Договор</option>
              <option value="CLAIM">Иск</option>
              <option value="COMPLAINT">Жалоба</option>
              <option value="DOCUMENT">Документ</option>
            </select>
            <input placeholder="Юрисдикция" value={newTpl.jurisdiction} onChange={(e) => setNewTpl({ ...newTpl, jurisdiction: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          </div>
          <textarea placeholder="Содержимое шаблона (Markdown)" value={newTpl.content} onChange={(e) => setNewTpl({ ...newTpl, content: e.target.value })} className="w-full h-40 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-3" />
          <Button variant="gradient" size="sm" onClick={handleCreate}><Save className="h-3.5 w-3.5" /> Создать</Button>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="bg-surface border border-border rounded-2xl p-4">
            {editId === t.id ? (
              <div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <input value={editForm.name ?? t.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                  <input value={editForm.type ?? t.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                  <input value={editForm.jurisdiction ?? t.jurisdiction} onChange={(e) => setEditForm({ ...editForm, jurisdiction: e.target.value })} className="h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <textarea value={editForm.content ?? t.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} className="w-full h-40 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent resize-none mb-3" />
                <div className="flex gap-2">
                  <Button variant="gradient" size="sm" onClick={() => handleUpdate(t.id, editForm)}><Save className="h-3.5 w-3.5" /> Сохранить</Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditId(null)}>Отмена</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{t.name}</span>
                    <Badge variant="default">{t.type}</Badge>
                    <Badge variant="default">{t.jurisdiction}</Badge>
                    {!t.isActive && <Badge variant="default">Неактивен</Badge>}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{t.content.slice(0, 100)}...</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="secondary" size="sm" onClick={() => { setEditId(t.id); setEditForm({}); }}>Изменить</Button>
                  <button onClick={() => handleDelete(t.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {templates.length === 0 && <p className="text-sm text-text-muted text-center py-8">Шаблоны не найдены</p>}
      </div>
    </div>
  );
}
