import { create } from "zustand";
import type { Agent, AgentSummary } from "@/types/agent";

export interface AgentToolInfo {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  iconColor: string;
  config: Record<string, unknown>;
  sortOrder: number;
}

interface AgentState {
  agents: AgentSummary[];
  activeAgent: Agent | null;
  agentTools: AgentToolInfo[];
  isLoading: boolean;

  setAgents: (agents: AgentSummary[]) => void;
  addAgent: (agent: AgentSummary) => void;
  updateAgent: (id: string, data: Partial<AgentSummary>) => void;
  removeAgent: (id: string) => void;
  setActiveAgent: (agent: Agent | null) => void;
  setAgentTools: (tools: AgentToolInfo[]) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  activeAgent: null,
  agentTools: [],
  isLoading: false,

  setAgents: (agents) => set({ agents }),

  addAgent: (agent) =>
    set((s) => ({ agents: [agent, ...s.agents] })),

  updateAgent: (id, data) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...data } : a)),
    })),

  removeAgent: (id) =>
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== id),
      activeAgent: s.activeAgent?.id === id ? null : s.activeAgent,
    })),

  setActiveAgent: (activeAgent) => set({ activeAgent }),
  setAgentTools: (agentTools) => set({ agentTools }),
  setLoading: (isLoading) => set({ isLoading }),
}));
