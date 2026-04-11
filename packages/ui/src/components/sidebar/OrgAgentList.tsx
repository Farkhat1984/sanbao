"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Bot, Network } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface OrgAgentItem {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  description: string | null;
  swarmEnabled?: boolean;
}

interface MultiAgentItem {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  icon: string | null;
  iconColor: string | null;
}

interface OrgInfo {
  orgName: string;
  agents: OrgAgentItem[];
  swarmEnabled: boolean;
}

export function OrgAgentList() {
  const { data: session } = useSession();
  const router = useRouter();
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const setActiveAgentId = useChatStore((s) => s.setActiveAgentId);
  const setMessages = useChatStore((s) => s.setMessages);
  const setOrgAgentId = useChatStore((s) => s.setOrgAgentId);
  const setSwarmMode = useChatStore((s) => s.setSwarmMode);
  const [agents, setAgents] = useState<OrgAgentItem[]>([]);
  const [multiAgents, setMultiAgents] = useState<MultiAgentItem[]>([]);
  const [orgSwarmMap, setOrgSwarmMap] = useState<Map<string, boolean>>(new Map());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/organizations/my-agents")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.agents) {
          setAgents(data.agents);
          setMultiAgents(data.multiAgents || []);
          // Build swarm enabled map from agents
          const swarmMap = new Map<string, boolean>();
          for (const a of data.agents) {
            if (a.swarmEnabled !== undefined && !swarmMap.has(a.orgId)) {
              swarmMap.set(a.orgId, a.swarmEnabled);
            }
          }
          setOrgSwarmMap(swarmMap);
        } else if (Array.isArray(data)) {
          // Backward compat
          setAgents(data);
        }
      })
      .catch(console.error);
  }, [session?.user]);

  if (agents.length === 0 && multiAgents.length === 0) return null;

  // Group by org
  const byOrg = new Map<string, OrgInfo>();
  for (const agent of agents) {
    const group = byOrg.get(agent.orgId) || { orgName: agent.orgName, agents: [], swarmEnabled: orgSwarmMap.get(agent.orgId) ?? true };
    group.agents.push(agent);
    byOrg.set(agent.orgId, group);
  }
  // Ensure orgs with only multiAgents also appear
  for (const ma of multiAgents) {
    if (!byOrg.has(ma.orgId)) {
      byOrg.set(ma.orgId, { orgName: ma.orgName, agents: [], swarmEnabled: false });
    }
  }

  const handleSelectAgent = (agent: OrgAgentItem) => {
    setActiveConversation(null);
    setActiveAgentId(null);
    setMessages([]);
    setOrgAgentId(agent.id);
    setSwarmMode(null); // clear swarm mode when selecting specific agent
    router.push("/chat");
  };

  const handleSelectSwarm = (orgId: string, multiAgentId: string) => {
    setActiveConversation(null);
    setActiveAgentId(null);
    setOrgAgentId(null);
    setMessages([]);
    setSwarmMode(orgId, multiAgentId);
    router.push("/chat");
  };

  return (
    <div className="px-3 py-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <Building2 className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Организации</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="mt-1 space-y-2">
          {Array.from(byOrg.entries()).map(([orgId, group]) => (
            <div key={orgId}>
              <p className="text-[10px] uppercase tracking-wider text-text-secondary px-1 mb-1">
                {group.orgName}
              </p>
              {/* Show each multiagent from this org */}
              {multiAgents
                .filter((ma) => ma.orgId === orgId)
                .map((ma) => (
                  <button
                    key={ma.id}
                    onClick={() => handleSelectSwarm(orgId, ma.id)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                  >
                    <Network className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">{ma.name}</span>
                  </button>
                ))}
              {group.agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <Bot className="h-3.5 w-3.5 text-accent shrink-0" />
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
