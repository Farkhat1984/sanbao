"use client";

import { useEffect, useState } from "react";
import { Bot, Sparkles, Building2, Network, Loader2 } from "lucide-react";
import { ICON_MAP } from "./AgentIconPicker";
import { cn } from "@/lib/utils";

interface AgentOption {
  id: string;
  name: string;
  description: string | null;
  icon?: string | null;
  iconColor?: string | null;
  type: "system" | "user" | "org";
  orgName?: string;
}

interface AgentPickerProps {
  selectedAgents: Array<{ type: string; id: string }>;
  onChange: (agents: Array<{ type: string; id: string }>) => void;
  orgId?: string;
}

export function AgentPicker({ selectedAgents, onChange, orgId }: AgentPickerProps) {
  const [systemAgents, setSystemAgents] = useState<AgentOption[]>([]);
  const [userAgents, setUserAgents] = useState<AgentOption[]>([]);
  const [orgAgents, setOrgAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const fetchAll = async () => {
      try {
        // Fetch system & user agents
        const agentsRes = await fetch("/api/agents?limit=100");
        const agentsData = await agentsRes.json();

        if (agentsData.systemAgents) {
          setSystemAgents(
            agentsData.systemAgents.map((a: AgentOption) => ({
              id: a.id,
              name: a.name,
              description: a.description,
              icon: a.icon,
              iconColor: a.iconColor,
              type: "system" as const,
            })),
          );
        }
        if (agentsData.userAgents) {
          setUserAgents(
            agentsData.userAgents.map((a: AgentOption) => ({
              id: a.id,
              name: a.name,
              description: a.description,
              icon: a.icon,
              iconColor: a.iconColor,
              type: "user" as const,
            })),
          );
        }

        // Fetch org agents
        if (orgId) {
          const orgRes = await fetch(`/api/organizations/${orgId}/agents`);
          const orgData = await orgRes.json();
          if (Array.isArray(orgData)) {
            setOrgAgents(
              orgData
                .filter((a: { status: string }) => a.status === "PUBLISHED")
                .map((a: AgentOption) => ({
                  id: a.id,
                  name: a.name,
                  description: a.description,
                  icon: a.icon,
                  iconColor: a.iconColor,
                  type: "org" as const,
                })),
            );
          }
        } else {
          const myRes = await fetch("/api/organizations/my-agents");
          const myData = await myRes.json();
          if (Array.isArray(myData)) {
            setOrgAgents(
              myData.map((a: AgentOption & { orgName?: string }) => ({
                id: a.id,
                name: a.name,
                description: a.description,
                icon: a.icon,
                iconColor: a.iconColor,
                type: "org" as const,
                orgName: a.orgName,
              })),
            );
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [orgId]);

  const isSelected = (type: string, id: string) =>
    selectedAgents.some((a) => a.type === type && a.id === id);

  const toggle = (type: string, id: string) => {
    if (isSelected(type, id)) {
      onChange(selectedAgents.filter((a) => !(a.type === type && a.id === id)));
    } else {
      onChange([...selectedAgents, { type, id }]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка агентов...
      </div>
    );
  }

  const renderGroup = (title: string, Icon: React.ElementType, agents: AgentOption[], type: string) => {
    if (agents.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className="h-3 w-3 text-text-secondary" />
          <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
            {title}
          </span>
        </div>
        <div className="space-y-1.5">
          {agents.map((agent) => {
            const selected = isSelected(type, agent.id);
            const AgentIcon = (agent.icon && ICON_MAP[agent.icon]) || Bot;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggle(type, agent.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left",
                  selected
                    ? "border-accent bg-accent/5"
                    : "border-border bg-surface-alt hover:border-border-hover",
                )}
              >
                <div
                  className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                    selected ? "bg-accent text-white" : "bg-surface",
                  )}
                  style={
                    !selected && agent.iconColor
                      ? { backgroundColor: agent.iconColor + "20", color: agent.iconColor }
                      : undefined
                  }
                >
                  <AgentIcon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {agent.name}
                  </p>
                  {agent.description && (
                    <p className="text-[11px] text-text-secondary truncate mt-0.5">
                      {agent.description}
                    </p>
                  )}
                </div>
                {agent.orgName && (
                  <span className="text-[9px] text-text-secondary bg-surface-alt px-1.5 py-0.5 rounded-full shrink-0">
                    {agent.orgName}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {selectedAgents.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-accent/5 border border-accent/20">
          <Network className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs text-accent font-medium">
            Выбрано: {selectedAgents.length} агентов
          </span>
        </div>
      )}
      {renderGroup("Системные", Sparkles, systemAgents, "system")}
      {renderGroup("Организации", Building2, orgAgents, "org")}
      {renderGroup("Мои агенты", Bot, userAgents, "user")}
      {systemAgents.length === 0 && userAgents.length === 0 && orgAgents.length === 0 && (
        <p className="text-sm text-text-secondary py-2">Нет доступных агентов</p>
      )}
    </div>
  );
}
