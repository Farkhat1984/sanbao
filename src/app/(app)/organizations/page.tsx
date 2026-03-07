"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Building2, Users, Bot } from "lucide-react";
import { useOrgStore, type OrgSummary } from "@/stores/orgStore";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

function OrgCard({ org }: { org: OrgSummary }) {
  const router = useRouter();

  const roleLabel: Record<string, string> = {
    OWNER: "Владелец",
    ADMIN: "Админ",
    MEMBER: "Участник",
  };

  const roleColor: Record<string, string> = {
    OWNER: "bg-accent/10 text-accent",
    ADMIN: "bg-warning/10 text-warning",
    MEMBER: "bg-success/10 text-success",
  };

  return (
    <button
      onClick={() => router.push(`/organizations/${org.id}`)}
      className="p-5 rounded-2xl border border-border bg-surface hover:border-border-hover hover:shadow-sm transition-all text-left cursor-pointer group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
          {org.avatar ? (
            <Avatar src={org.avatar} name={org.name} size="sm" />
          ) : (
            <Building2 className="h-5 w-5 text-accent" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
            {org.name}
          </h3>
          <span className={cn("inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium", roleColor[org.role] || roleColor.MEMBER)}>
            {roleLabel[org.role] || org.role}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {org.memberCount}
        </span>
        <span className="flex items-center gap-1">
          <Bot className="h-3.5 w-3.5" />
          {org.agentCount}
        </span>
      </div>
    </button>
  );
}

export default function OrganizationsPage() {
  const router = useRouter();
  const { organizations, setOrganizations } = useOrgStore();
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/organizations")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setOrganizations(data);
      })
      .catch(console.error)
      .finally(() => {
        setIsLoading(false);
        setLoaded(true);
      });
  }, [setOrganizations]);

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">Организации</h1>
            <p className="text-sm text-text-secondary mt-1">
              Управляйте командами и AI-агентами
            </p>
          </div>
          <button
            onClick={() => router.push("/organizations/new")}
            className="h-10 px-5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Создать организацию
          </button>
        </div>

        {isLoading && !loaded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-2xl border border-border bg-surface animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-surface-alt" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-surface-alt rounded" />
                    <div className="h-3 w-16 bg-surface-alt rounded mt-2" />
                  </div>
                </div>
                <div className="h-3 w-24 bg-surface-alt rounded" />
              </div>
            ))}
          </div>
        )}

        {loaded && organizations.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
          </div>
        )}

        {loaded && organizations.length === 0 && (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-5">
              <Building2 className="h-8 w-8 text-text-secondary" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Нет организаций
            </h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
              Создайте организацию, загрузите документы и получите AI-агента для вашей команды.
            </p>
            <button
              onClick={() => router.push("/organizations/new")}
              className="h-10 px-6 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer"
            >
              Создать организацию
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
