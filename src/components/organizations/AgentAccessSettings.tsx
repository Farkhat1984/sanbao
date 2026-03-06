"use client";

import { useState, useEffect } from "react";
import { Users, Lock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface AccessData {
  accessMode: string;
  members: Member[];
}

export function AgentAccessSettings({
  orgId,
  agentId,
}: {
  orgId: string;
  agentId: string;
}) {
  const [accessMode, setAccessMode] = useState<"ALL_MEMBERS" | "SPECIFIC">("ALL_MEMBERS");
  const [orgMembers, setOrgMembers] = useState<Member[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load current access settings
    fetch(`/api/organizations/${orgId}/agents/${agentId}/access`)
      .then((r) => r.json())
      .then((data: AccessData) => {
        setAccessMode(data.accessMode as "ALL_MEMBERS" | "SPECIFIC");
        setSelectedIds(new Set(data.members.map((m) => m.userId)));
      })
      .catch(console.error);

    // Load org members
    fetch(`/api/organizations/${orgId}/members`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOrgMembers(data);
      })
      .catch(console.error);
  }, [orgId, agentId]);

  const toggleMember = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/organizations/${orgId}/agents/${agentId}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessMode,
          memberUserIds: Array.from(selectedIds),
        }),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">Доступ к агенту</h3>

      <div className="flex gap-3">
        <button
          onClick={() => setAccessMode("ALL_MEMBERS")}
          className={cn(
            "flex-1 p-3 rounded-xl border text-left transition-colors cursor-pointer",
            accessMode === "ALL_MEMBERS"
              ? "border-accent bg-accent/5"
              : "border-border hover:border-border-hover"
          )}
        >
          <Users className="h-4 w-4 text-accent mb-1" />
          <div className="text-sm font-medium text-text-primary">Все участники</div>
          <div className="text-xs text-text-muted">Доступ для всех</div>
        </button>
        <button
          onClick={() => setAccessMode("SPECIFIC")}
          className={cn(
            "flex-1 p-3 rounded-xl border text-left transition-colors cursor-pointer",
            accessMode === "SPECIFIC"
              ? "border-accent bg-accent/5"
              : "border-border hover:border-border-hover"
          )}
        >
          <Lock className="h-4 w-4 text-accent mb-1" />
          <div className="text-sm font-medium text-text-primary">Выборочный</div>
          <div className="text-xs text-text-muted">Только выбранные</div>
        </button>
      </div>

      {accessMode === "SPECIFIC" && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {orgMembers.map((member) => (
            <label
              key={member.userId}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-alt cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(member.userId)}
                onChange={() => toggleMember(member.userId)}
                className="rounded border-border"
              />
              <Avatar src={member.user.image} name={member.user.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {member.user.name || member.user.email}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="h-9 px-4 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
      >
        {saving ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
}
