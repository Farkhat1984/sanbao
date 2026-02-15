"use client";

import { useState, useEffect } from "react";
import { Plus, Save, Trash2, Shield, Globe, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DEFAULT_ICON_COLOR, DEFAULT_SKILL_ICON } from "@/lib/constants";

interface Skill {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  templates: unknown;
  citationRules: string | null;
  jurisdiction: string | null;
  icon: string;
  iconColor: string;
  isBuiltIn: boolean;
  isPublic: boolean;
  status: string;
  user: { id: string; name: string | null; email: string } | null;
  _count?: { agents: number };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Черновик", color: "text-text-muted" },
  PENDING: { label: "На модерации", color: "text-warning" },
  APPROVED: { label: "Одобрен", color: "text-success" },
  REJECTED: { label: "Отклонён", color: "text-error" },
};

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Skill>>({});
  const [newSkill, setNewSkill] = useState({
    name: "", description: "", systemPrompt: "", citationRules: "", jurisdiction: "RU", icon: DEFAULT_SKILL_ICON, iconColor: DEFAULT_ICON_COLOR,
  });

  const [stats, setStats] = useState<{ totalSkills: number; activeSkills: number; pendingSkills: number } | null>(null);

  const fetchSkills = async () => {
    const res = await fetch(`/api/admin/skills?type=${filter}`);
    setSkills(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchSkills(); }, [filter]);
  useEffect(() => {
    fetch("/api/admin/skills/stats").then((r) => r.json()).then(setStats).catch(console.error);
  }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/admin/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSkill),
    });
    if (res.ok) {
      setAdding(false);
      setNewSkill({ name: "", description: "", systemPrompt: "", citationRules: "", jurisdiction: "RU", icon: DEFAULT_SKILL_ICON, iconColor: DEFAULT_ICON_COLOR });
      fetchSkills();
    }
  };

  const handleUpdate = async (id: string, data: Partial<Skill>) => {
    await fetch(`/api/admin/skills/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditId(null);
    fetchSkills();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить скилл?")) return;
    await fetch(`/api/admin/skills/${id}`, { method: "DELETE" });
    fetchSkills();
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
          <h1 className="text-xl font-bold text-text-primary">Скиллы</h1>
          <p className="text-sm text-text-muted mt-1">Системные и пользовательские скиллы</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-text-primary">{stats.totalSkills}</p>
            <p className="text-xs text-text-muted">Всего</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-success">{stats.activeSkills}</p>
            <p className="text-xs text-text-muted">Активных</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-warning">{stats.pendingSkills}</p>
            <p className="text-xs text-text-muted">На модерации</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-4 flex-wrap">
        {[["all", "Все"], ["builtin", "Системные"], ["public", "Публичные"], ["pending", "На модерации"], ["approved", "Одобренные"], ["rejected", "Отклонённые"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${filter === val ? "bg-accent text-white" : "text-text-secondary hover:bg-surface-alt"}`}>{label}</button>
        ))}
      </div>

      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Новый скилл</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <input placeholder="Название" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Иконка (Scale, FileSearch...)" value={newSkill.icon} onChange={(e) => setNewSkill({ ...newSkill, icon: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Юрисдикция (RU)" value={newSkill.jurisdiction} onChange={(e) => setNewSkill({ ...newSkill, jurisdiction: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          </div>
          <textarea placeholder="Описание" value={newSkill.description} onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })} className="w-full h-16 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-3" />
          <textarea placeholder="Системный промпт" value={newSkill.systemPrompt} onChange={(e) => setNewSkill({ ...newSkill, systemPrompt: e.target.value })} className="w-full h-32 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-3" />
          <textarea placeholder="Правила цитирования" value={newSkill.citationRules} onChange={(e) => setNewSkill({ ...newSkill, citationRules: e.target.value })} className="w-full h-16 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-3" />
          <Button variant="gradient" size="sm" onClick={handleCreate}><Save className="h-3.5 w-3.5" /> Создать</Button>
        </div>
      )}

      <div className="space-y-2">
        {skills.map((s) => (
          <div key={s.id} className="bg-surface border border-border rounded-2xl p-4">
            {editId === s.id ? (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  <div><label className="text-xs text-text-muted block mb-1">Название</label><input value={editForm.name ?? s.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
                  <div><label className="text-xs text-text-muted block mb-1">Юрисдикция</label><input value={editForm.jurisdiction ?? s.jurisdiction ?? ""} onChange={(e) => setEditForm({ ...editForm, jurisdiction: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
                  <div><label className="text-xs text-text-muted block mb-1">Иконка</label><input value={editForm.icon ?? s.icon} onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })} className="w-full h-8 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
                </div>
                <textarea value={editForm.systemPrompt ?? s.systemPrompt} onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })} className="w-full h-32 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent resize-none mb-3" />
                <textarea value={editForm.citationRules ?? s.citationRules ?? ""} onChange={(e) => setEditForm({ ...editForm, citationRules: e.target.value })} placeholder="Правила цитирования" className="w-full h-16 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent resize-none mb-3" />
                <div className="flex gap-2">
                  <Button variant="gradient" size="sm" onClick={() => handleUpdate(s.id, editForm)}><Save className="h-3.5 w-3.5" /> Сохранить</Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditId(null)}>Отмена</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: s.iconColor }}>{s.icon.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{s.name}</span>
                      {s.isBuiltIn && <Badge variant="accent"><Shield className="h-3 w-3" /> Системный</Badge>}
                      {s.isPublic && <Badge variant="default"><Globe className="h-3 w-3" /> Публичный</Badge>}
                      {!s.isBuiltIn && s.status && (
                        <span className={`text-xs font-medium ${STATUS_LABELS[s.status]?.color || "text-text-muted"}`}>
                          {STATUS_LABELS[s.status]?.label || s.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {s.jurisdiction} &middot; {s._count?.agents || 0} агентов
                      {s.user && <> &middot; {s.user.name || s.user.email}</>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!s.isBuiltIn && s.status === "PENDING" && (
                    <>
                      <Button variant="gradient" size="sm" onClick={() => handleUpdate(s.id, { status: "APPROVED" })}>
                        <CheckCircle className="h-3.5 w-3.5" /> Одобрить
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleUpdate(s.id, { status: "REJECTED" })}>
                        <XCircle className="h-3.5 w-3.5" /> Отклонить
                      </Button>
                    </>
                  )}
                  {!s.isBuiltIn && s.status === "REJECTED" && (
                    <Button variant="gradient" size="sm" onClick={() => handleUpdate(s.id, { status: "APPROVED" })}>
                      <CheckCircle className="h-3.5 w-3.5" /> Одобрить
                    </Button>
                  )}
                  {!s.isBuiltIn && s.status === "APPROVED" && (
                    <Button variant="secondary" size="sm" onClick={() => handleUpdate(s.id, { status: "REJECTED" })}>
                      <XCircle className="h-3.5 w-3.5" /> Отклонить
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => { setEditId(s.id); setEditForm({}); }}>Изменить</Button>
                  <button onClick={() => handleDelete(s.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {skills.length === 0 && <p className="text-sm text-text-muted text-center py-8">Скиллы не найдены</p>}
      </div>
    </div>
  );
}
