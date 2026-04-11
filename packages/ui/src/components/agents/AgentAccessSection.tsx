"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Shield, Globe, UserPlus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgMemberUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface AccessMember {
  id: string;
  userId: string;
  user: OrgMemberUser;
}

interface AgentAccessSectionProps {
  /** API path for access endpoint, e.g. /api/organizations/{orgId}/agents/{agentId}/access */
  accessPath: string;
  /** API path for org members list, e.g. /api/organizations/{orgId}/members */
  membersPath: string;
  /** Label for the entity type */
  entityLabel?: string;
}

export function AgentAccessSection({
  accessPath,
  membersPath,
  entityLabel = "агенту",
}: AgentAccessSectionProps) {
  const [accessMode, setAccessMode] = useState<"ALL_MEMBERS" | "SPECIFIC">("ALL_MEMBERS");
  const [members, setMembers] = useState<AccessMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<Array<{ id: string; userId: string; role: string; user: OrgMemberUser }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const loadAccess = useCallback(async () => {
    try {
      const res = await fetch(accessPath);
      if (!res.ok) return;
      const data = await res.json();
      setAccessMode(data.accessMode || "ALL_MEMBERS");
      setMembers(data.members || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [accessPath]);

  const loadOrgMembers = useCallback(async () => {
    try {
      const res = await fetch(`${membersPath}?limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      setOrgMembers(data.members || []);
    } catch {
      // silent
    }
  }, [membersPath]);

  useEffect(() => {
    loadAccess();
    loadOrgMembers();
  }, [loadAccess, loadOrgMembers]);

  const save = async (mode: "ALL_MEMBERS" | "SPECIFIC", userIds: string[]) => {
    setSaving(true);
    try {
      await fetch(accessPath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessMode: mode, memberUserIds: userIds }),
      });
      setAccessMode(mode);
      await loadAccess();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMode = async (mode: "ALL_MEMBERS" | "SPECIFIC") => {
    const userIds = mode === "SPECIFIC" ? members.map((m) => m.userId) : [];
    await save(mode, userIds);
  };

  const handleAddMember = async (userId: string) => {
    const currentIds = members.map((m) => m.userId);
    if (currentIds.includes(userId)) return;
    await save("SPECIFIC", [...currentIds, userId]);
    setShowPicker(false);
  };

  const handleRemoveMember = async (userId: string) => {
    const newIds = members.filter((m) => m.userId !== userId).map((m) => m.userId);
    await save("SPECIFIC", newIds);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка...
      </div>
    );
  }

  // Filter org members: only non-admin/non-owner members who aren't already added
  const addableMembers = orgMembers.filter(
    (om) =>
      om.role === "MEMBER" &&
      !members.some((m) => m.userId === om.userId)
  );

  return (
    <div className="space-y-3">
      {/* Access mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleToggleMode("ALL_MEMBERS")}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer",
            accessMode === "ALL_MEMBERS"
              ? "bg-accent/10 text-accent border border-accent/30"
              : "bg-surface-alt text-text-secondary border border-border hover:text-text-primary"
          )}
        >
          <Globe className="h-4 w-4" />
          Все участники
        </button>
        <button
          type="button"
          onClick={() => handleToggleMode("SPECIFIC")}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer",
            accessMode === "SPECIFIC"
              ? "bg-accent/10 text-accent border border-accent/30"
              : "bg-surface-alt text-text-secondary border border-border hover:text-text-primary"
          )}
        >
          <Shield className="h-4 w-4" />
          Выбранные
        </button>
      </div>

      {accessMode === "ALL_MEMBERS" && (
        <p className="text-xs text-text-secondary">
          Все участники организации имеют доступ к {entityLabel}
        </p>
      )}

      {accessMode === "SPECIFIC" && (
        <div className="space-y-2">
          <p className="text-xs text-text-secondary">
            Только выбранные участники имеют доступ к {entityLabel}.
            Админы и владелец всегда имеют доступ.
          </p>

          {/* Current members with access */}
          {members.length > 0 && (
            <div className="space-y-1">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface-alt transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {m.user.image ? (
                      <img
                        src={m.user.image}
                        alt=""
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-accent">
                          {(m.user.name || m.user.email)[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-sm text-text-primary">
                      {m.user.name || m.user.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.userId)}
                    disabled={saving}
                    className="p-1 rounded-md text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add member button / picker */}
          {!showPicker ? (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              disabled={addableMembers.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-accent hover:bg-accent/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="h-4 w-4" />
              Добавить участника
            </button>
          ) : (
            <div className="border border-border rounded-xl bg-surface-alt overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-medium text-text-secondary">
                  Выберите участника
                </span>
                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  className="p-0.5 rounded text-text-muted hover:text-text-primary cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {addableMembers.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-text-muted text-center">
                    Нет участников для добавления
                  </p>
                ) : (
                  addableMembers.map((om) => (
                    <button
                      key={om.id}
                      type="button"
                      onClick={() => handleAddMember(om.userId)}
                      disabled={saving}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface transition-colors cursor-pointer text-left"
                    >
                      {om.user.image ? (
                        <img
                          src={om.user.image}
                          alt=""
                          className="h-6 w-6 rounded-full"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center">
                          <span className="text-[10px] font-medium text-accent">
                            {(om.user.name || om.user.email)[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-text-primary block">
                          {om.user.name || om.user.email}
                        </span>
                        {om.user.name && (
                          <span className="text-xs text-text-muted">
                            {om.user.email}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
