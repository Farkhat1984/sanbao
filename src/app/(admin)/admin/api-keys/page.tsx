"use client";

import { useState, useEffect } from "react";
import { Plus, Key, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface ApiKeyEntry {
  id: string;
  name: string;
  key: string;
  userId: string;
  isActive: boolean;
  rateLimit: number;
  lastUsed: string | null;
  expiresAt: string | null;
  user: { id: string; name: string | null; email: string };
  createdAt: string;
}

export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState({ userId: "", name: "", rateLimit: 60 });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState(60);

  const fetchKeys = async () => {
    const res = await fetch("/api/admin/api-keys");
    setKeys(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/api-keys/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchKeys();
  };

  const handleUpdateRate = async (id: string) => {
    await fetch(`/api/admin/api-keys/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rateLimit: editRate }),
    });
    setEditId(null);
    fetchKeys();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить API-ключ?")) return;
    await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
    fetchKeys();
  };

  const handleCreate = async () => {
    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newKey),
    });
    if (res.ok) {
      const data = await res.json();
      setCreatedKey(data.key);
      setAdding(false);
      setNewKey({ userId: "", name: "", rateLimit: 60 });
      fetchKeys();
    }
  };

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-20" />)}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">API-ключи</h1>
          <p className="text-sm text-text-muted mt-1">Управление ключами доступа</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setAdding(!adding)}><Plus className="h-4 w-4" /> Создать</Button>
      </div>

      {createdKey && (
        <div className="bg-success/10 border border-success/30 rounded-2xl p-5 mb-4">
          <p className="text-sm font-medium text-success mb-2">Ключ создан! Скопируйте — он больше не будет показан:</p>
          <code className="text-xs bg-surface p-2 rounded-lg block break-all text-text-primary">{createdKey}</code>
          <Button variant="secondary" size="sm" onClick={() => setCreatedKey(null)} className="mt-2">Закрыть</Button>
        </div>
      )}

      {adding && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="User ID" value={newKey.userId} onChange={(e) => setNewKey({ ...newKey, userId: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Название ключа" value={newKey.name} onChange={(e) => setNewKey({ ...newKey, name: e.target.value })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            <input placeholder="Rate limit (req/min)" type="number" value={newKey.rateLimit} onChange={(e) => setNewKey({ ...newKey, rateLimit: parseInt(e.target.value) || 60 })} className="h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
          </div>
          <div className="mt-3"><Button variant="gradient" size="sm" onClick={handleCreate}><Key className="h-3.5 w-3.5" /> Создать ключ</Button></div>
        </div>
      )}

      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-4 w-4 text-text-muted" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{k.name}</span>
                  <span className="text-xs font-mono text-text-muted">{k.key}</span>
                  {!k.isActive && <Badge variant="default">Неактивен</Badge>}
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {k.user.name || k.user.email}
                  &middot; {k.rateLimit || 60} req/min
                  {k.lastUsed && <> &middot; Посл. исп.: {new Date(k.lastUsed).toLocaleDateString("ru-RU")}</>}
                  {k.expiresAt && <> &middot; Истекает: {new Date(k.expiresAt).toLocaleDateString("ru-RU")}</>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {editId === k.id ? (
                <div className="flex items-center gap-1">
                  <input type="number" value={editRate} onChange={(e) => setEditRate(parseInt(e.target.value) || 60)} className="h-8 w-20 px-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary focus:outline-none focus:border-accent" />
                  <Button variant="gradient" size="sm" onClick={() => handleUpdateRate(k.id)}><Save className="h-3 w-3" /></Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditId(null)}>X</Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => { setEditId(k.id); setEditRate(k.rateLimit || 60); }}>Rate</Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => handleToggle(k.id, k.isActive)}>
                {k.isActive ? "Откл." : "Вкл."}
              </Button>
              <button onClick={() => handleDelete(k.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {keys.length === 0 && <p className="text-sm text-text-muted text-center py-8">API-ключи не созданы</p>}
      </div>
    </div>
  );
}
