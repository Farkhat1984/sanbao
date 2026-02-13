import { create } from "zustand";

interface PlanInfo {
  slug: string;
  name: string;
  description: string | null;
  price: string;
  messagesPerDay: number;
  tokensPerMessage: number;
  tokensPerMonth: number;
  requestsPerMinute: number;
  contextWindowSize: number;
  maxConversations: number;
  maxAgents: number;
  documentsPerMonth: number;
  canUseAdvancedTools: boolean;
  canUseReasoning: boolean;
  canUseRag: boolean;
  canUseGraph: boolean;
  canChooseProvider: boolean;
  highlighted?: boolean;
}

interface UsageInfo {
  messageCount: number;
  tokenCount: number;
}

interface BillingState {
  plan: PlanInfo | null;
  usage: UsageInfo | null;
  monthlyUsage: UsageInfo | null;
  plans: PlanInfo[];
  isLoading: boolean;
  setPlan: (plan: PlanInfo) => void;
  setUsage: (usage: UsageInfo) => void;
  setMonthlyUsage: (usage: UsageInfo) => void;
  setPlans: (plans: PlanInfo[]) => void;
  setLoading: (loading: boolean) => void;
  incrementMessageCount: () => void;
}

export const useBillingStore = create<BillingState>((set) => ({
  plan: null,
  usage: null,
  monthlyUsage: null,
  plans: [],
  isLoading: false,
  setPlan: (plan) => set({ plan }),
  setUsage: (usage) => set({ usage }),
  setMonthlyUsage: (monthlyUsage) => set({ monthlyUsage }),
  setPlans: (plans) => set({ plans }),
  setLoading: (isLoading) => set({ isLoading }),
  incrementMessageCount: () =>
    set((s) => ({
      usage: s.usage
        ? { ...s.usage, messageCount: s.usage.messageCount + 1 }
        : s.usage,
    })),
}));
