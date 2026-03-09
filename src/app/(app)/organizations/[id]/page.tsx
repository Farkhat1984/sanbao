"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Bot, Trash2, Network } from "lucide-react";
import { useOrgStore } from "@/stores/orgStore";
import { cn } from "@/lib/utils";

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { setActiveOrg } = useOrgStore();
  const [org, setOrg] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/organizations/${id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            setOrg(data);
            setActiveOrg(data);
          }
        })
        .catch(() => setError("Ошибка загрузки"))
        .finally(() => setIsLoading(false));
    });
  }, [params, setActiveOrg]);

  const handleDelete = async () => {
    if (!org || !confirm("Удалить организацию? Все данные будут потеряны.")) return;
    setDeleting(true);
    const { id } = await params;
    try {
      const res = await fetch(`/api/organizations/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/organizations");
      }
    } catch {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-surface-alt rounded" />
          <div className="h-4 w-32 bg-surface-alt rounded" />
          <div className="h-32 bg-surface-alt rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-center">
        <p className="text-text-secondary">{error || "Организация не найдена"}</p>
      </div>
    );
  }

  const isOwner = org.role === "OWNER";

  return (
    <div className="h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => router.push("/organizations")}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Организации
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">{org.name as string}</h1>
            <p className="text-sm text-text-secondary mt-1">
              {(org.memberCount as number)} участник(ов) · {(org.agentCount as number)} агент(ов)
            </p>
          </div>
          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="h-9 px-4 rounded-xl border border-error/20 text-error text-sm font-medium flex items-center gap-2 hover:bg-error-light transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Удаление..." : "Удалить"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NavCard
            icon={Users}
            title="Участники"
            description={`${org.memberCount as number} человек`}
            onClick={async () => { const { id } = await params; router.push(`/organizations/${id}/members`); }}
          />
          <NavCard
            icon={Bot}
            title="AI-агенты"
            description={`${org.agentCount as number} агентов`}
            onClick={async () => { const { id } = await params; router.push(`/organizations/${id}/agents`); }}
          />
          <NavCard
            icon={Network}
            title="Мультиагент"
            description="Создать или выбрать команду"
            onClick={async () => {
              const { id } = await params;
              router.push(`/organizations/${id}/multiagent/new`);
            }}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-500"
          />
        </div>
      </div>
    </div>
  );
}

function NavCard({
  icon: Icon,
  title,
  description,
  onClick,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-5 rounded-2xl border border-border bg-surface",
        "hover:border-border-hover hover:shadow-sm transition-all text-left cursor-pointer group"
      )}
    >
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3", iconBg || "bg-accent/10")}>
        <Icon className={cn("h-5 w-5", iconColor || "text-accent")} />
      </div>
      <h3 className="font-semibold text-text-primary group-hover:text-accent transition-colors">
        {title}
      </h3>
      <p className="text-sm text-text-secondary mt-1">{description}</p>
    </button>
  );
}
