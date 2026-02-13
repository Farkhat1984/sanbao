import { create } from "zustand";
import type { Agent, AgentSummary } from "@/types/agent";

interface AgentState {
  agents: AgentSummary[];
  activeAgent: Agent | null;
  isLoading: boolean;

  setAgents: (agents: AgentSummary[]) => void;
  addAgent: (agent: AgentSummary) => void;
  updateAgent: (id: string, data: Partial<AgentSummary>) => void;
  removeAgent: (id: string) => void;
  setActiveAgent: (agent: Agent | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  activeAgent: null,
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
  setLoading: (isLoading) => set({ isLoading }),
}));
