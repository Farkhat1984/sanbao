"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BuildingOffice, CaretDown, Robot } from "@phosphor-icons/react";
import { useChatStore } from "@/stores/chatStore";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface OrgAgentItem {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  description: string | null;
}

export function OrgAgentList() {
  const { data: session } = useSession();
  const router = useRouter();
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const setActiveAgentId = useChatStore((s) => s.setActiveAgentId);
  const setMessages = useChatStore((s) => s.setMessages);
  const setOrgAgentId = useChatStore((s) => s.setOrgAgentId);
  const [agents, setAgents] = useState<OrgAgentItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/organizations/my-agents")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAgents(data);
        }
      })
      .catch(console.error);
  }, [session?.user]);

  if (agents.length === 0) return null;

  // Group by org
  const byOrg = new Map<string, { orgName: string; agents: OrgAgentItem[] }>();
  for (const agent of agents) {
    const group = byOrg.get(agent.orgId) || { orgName: agent.orgName, agents: [] };
    group.agents.push(agent);
    byOrg.set(agent.orgId, group);
  }

  const handleSelectAgent = (agent: OrgAgentItem) => {
    setActiveConversation(null);
    setActiveAgentId(null);
    setMessages([]);
    setOrgAgentId(agent.id);
    router.push("/chat");
  };

  return (
    <div className="px-3 py-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <BuildingOffice weight="duotone" className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Организации</span>
        <CaretDown weight="duotone" className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="mt-1 space-y-2">
          {Array.from(byOrg.entries()).map(([orgId, group]) => (
            <div key={orgId}>
              <p className="text-[10px] uppercase tracking-wider text-text-secondary px-1 mb-1">
                {group.orgName}
              </p>
              {group.agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <Robot weight="duotone" className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="truncate">{agent.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
