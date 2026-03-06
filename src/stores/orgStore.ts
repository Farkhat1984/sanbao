import { create } from "zustand";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  role: string;
  memberCount: number;
  agentCount: number;
  createdAt: string;
}

export interface OrgMemberInfo {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string | null; email: string; image: string | null };
  joinedAt: string;
}

export interface OrgAgentSummary {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  description: string | null;
  status: string;
  accessMode: string;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

interface OrgState {
  organizations: OrgSummary[];
  activeOrg: OrgSummary | null;
  members: OrgMemberInfo[];
  agents: OrgAgentSummary[];
  isLoading: boolean;

  setOrganizations: (orgs: OrgSummary[]) => void;
  addOrganization: (org: OrgSummary) => void;
  updateOrganization: (id: string, data: Partial<OrgSummary>) => void;
  removeOrganization: (id: string) => void;
  setActiveOrg: (org: OrgSummary | null) => void;
  setMembers: (members: OrgMemberInfo[]) => void;
  removeMember: (id: string) => void;
  setAgents: (agents: OrgAgentSummary[]) => void;
  addAgent: (agent: OrgAgentSummary) => void;
  updateAgent: (id: string, data: Partial<OrgAgentSummary>) => void;
  removeAgent: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useOrgStore = create<OrgState>((set) => ({
  organizations: [],
  activeOrg: null,
  members: [],
  agents: [],
  isLoading: false,

  setOrganizations: (organizations) => set({ organizations }),
  addOrganization: (org) => set((s) => ({ organizations: [org, ...s.organizations] })),
  updateOrganization: (id, data) =>
    set((s) => ({
      organizations: s.organizations.map((o) => (o.id === id ? { ...o, ...data } : o)),
      activeOrg: s.activeOrg?.id === id ? { ...s.activeOrg, ...data } : s.activeOrg,
    })),
  removeOrganization: (id) =>
    set((s) => ({
      organizations: s.organizations.filter((o) => o.id !== id),
      activeOrg: s.activeOrg?.id === id ? null : s.activeOrg,
    })),
  setActiveOrg: (activeOrg) => set({ activeOrg }),
  setMembers: (members) => set({ members }),
  removeMember: (id) => set((s) => ({ members: s.members.filter((m) => m.id !== id) })),
  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set((s) => ({ agents: [agent, ...s.agents] })),
  updateAgent: (id, data) =>
    set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, ...data } : a)) })),
  removeAgent: (id) => set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
  setLoading: (isLoading) => set({ isLoading }),
}));
