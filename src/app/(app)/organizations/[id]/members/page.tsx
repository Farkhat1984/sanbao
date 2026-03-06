"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Shield, Crown, User, X } from "lucide-react";
import { useOrgStore, type OrgMemberInfo } from "@/stores/orgStore";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export default function OrgMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { members, setMembers, activeOrg } = useOrgStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    params.then(({ id }) => {
      setOrgId(id);
      fetch(`/api/organizations/${id}/members`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setMembers(data);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    });
  }, [params, setMembers]);

  const isAdmin = activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`/api/organizations/${orgId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteMsg("Приглашение отправлено!");
        setInviteEmail("");
      } else {
        setInviteMsg(data.error || "Ошибка");
      }
    } catch {
      setInviteMsg("Ошибка сети");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (member: OrgMemberInfo) => {
    if (!confirm(`Удалить ${member.user.name || member.user.email}?`)) return;
    try {
      const res = await fetch(`/api/organizations/${orgId}/members/${member.userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMembers(members.filter((m) => m.id !== member.id));
      }
    } catch {
      // ignore
    }
  };

  const roleIcon: Record<string, React.ElementType> = {
    OWNER: Crown,
    ADMIN: Shield,
    MEMBER: User,
  };

  const roleLabel: Record<string, string> = {
    OWNER: "Владелец",
    ADMIN: "Администратор",
    MEMBER: "Участник",
  };

  return (
    <div className="h-full">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => router.push(`/organizations/${orgId}`)}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-text-primary">Участники</h1>
          {isAdmin && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="h-9 px-4 rounded-xl bg-accent text-white text-sm font-medium flex items-center gap-2 hover:bg-accent-hover transition-colors cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              Пригласить
            </button>
          )}
        </div>

        {showInvite && (
          <form onSubmit={handleInvite} className="p-4 rounded-2xl border border-border bg-surface mb-6 space-y-3">
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="flex-1 h-10 px-4 rounded-xl border border-border bg-bg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "MEMBER" | "ADMIN")}
                className="h-10 px-3 rounded-xl border border-border bg-bg text-text-primary text-sm"
              >
                <option value="MEMBER">Участник</option>
                <option value="ADMIN">Админ</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">{inviteMsg}</span>
              <button
                type="submit"
                disabled={inviting}
                className="h-9 px-4 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
              >
                {inviting ? "Отправка..." : "Отправить"}
              </button>
            </div>
          </form>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-surface-alt animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="space-y-2">
            {members.map((member) => {
              const RoleIcon = roleIcon[member.role] || User;
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface"
                >
                  <Avatar src={member.user.image} name={member.user.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {member.user.name || member.user.email}
                    </p>
                    <p className="text-xs text-text-muted truncate">{member.user.email}</p>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                    member.role === "OWNER" ? "bg-amber-500/10 text-amber-600" :
                    member.role === "ADMIN" ? "bg-accent/10 text-accent" :
                    "bg-surface-alt text-text-muted"
                  )}>
                    <RoleIcon className="h-3 w-3" />
                    {roleLabel[member.role]}
                  </div>
                  {isAdmin && member.role !== "OWNER" && (
                    <button
                      onClick={() => handleRemove(member)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
