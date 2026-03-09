"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Power, PowerOff, GripVertical, Pencil, Wrench, Globe, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";

interface SystemAgent {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  icon: string;
  iconColor: string;
  model: string;
  starterPrompts: string[];
  isActive: boolean;
  sortOrder: number;
  skills: Array<{ id: string; name: string }>;
  mcpServers: Array<{ id: string; name: string }>;
  tools: Array<{ id: string; name: string }>;
}

const AGENTS_PER_PAGE = 25;

export default function AdminAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<SystemAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(AGENTS_PER_PAGE),
    });
    const res = await fetch(`/api/admin/system-agents?${params}`);
    const data = await res.json();
    setAgents(data.agents || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/system-agents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchAgents();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить системного агента?")) return;
    await fetch(`/api/admin/system-agents/${id}`, { method: "DELETE" });
    fetchAgents();
  };

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
    const reordered = items.map((a, i) => ({ ...a, sortOrder: (page - 1) * AGENTS_PER_PAGE + i }));
    setAgents(reordered);
    setDragId(null);
    await fetch("/api/admin/system-agents/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map((a) => a.id) }),
    });
  };

  if (loading) {
    return <AdminListSkeleton rows={3} height="h-24" />;
  }

  const totalPages = Math.ceil(total / AGENTS_PER_PAGE);

  return (
    <div>
      <AdminPageHeader
        title="Системные агенты"
        subtitle="Управление встроенными агентами"
        count={total}
        action={
          <Button variant="gradient" size="sm" onClick={() => router.push("/admin/agents/new")}>
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        }
      />

      <div className="space-y-3">
        {agents.map((a) => {
          const IconComp = ICON_MAP[a.icon] || ICON_MAP.Bot;
          const attachmentCount = (a.skills?.length || 0) + (a.mcpServers?.length || 0) + (a.tools?.length || 0);

          return (
            <div
              key={a.id}
              className={`bg-surface border rounded-2xl p-5 transition-colors ${dragId === a.id ? "border-accent/50 opacity-50" : "border-border"}`}
              draggable
              onDragStart={() => handleDragStart(a.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(a.id)}
              onDragEnd={() => setDragId(null)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <GripVertical className="h-4 w-4 text-text-secondary cursor-grab active:cursor-grabbing shrink-0" />
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: a.iconColor }}
                  >
                    <IconComp className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{a.name}</span>
                      <span className={`h-2 w-2 rounded-full shrink-0 ${a.isActive ? "bg-success" : "bg-text-muted"}`} />
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{a.description || "Без описания"}</p>
                    {/* Attachment badges */}
                    {attachmentCount > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {a.mcpServers?.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-medium">
                            <Globe className="h-2.5 w-2.5" />
                            MCP: {a.mcpServers.length}
                          </span>
                        )}
                        {a.tools?.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warning/10 text-warning text-[10px] font-medium">
                            <Wrench className="h-2.5 w-2.5" />
                            {a.tools.length}
                          </span>
                        )}
                        {a.skills?.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-success/10 text-success text-[10px] font-medium">
                            <BookOpen className="h-2.5 w-2.5" />
                            {a.skills.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <Button variant="secondary" size="sm" onClick={() => handleToggle(a.id, a.isActive)}>
                    {a.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/agents/${a.id}/edit`)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Изменить
                  </Button>
                  <AdminDeleteButton onClick={() => handleDelete(a.id)} />
                </div>
              </div>
            </div>
          );
        })}
        {agents.length === 0 && <AdminEmptyState message="Системные агенты не найдены" />}

        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="агентов"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
