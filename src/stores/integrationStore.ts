import { create } from "zustand";
import type { IntegrationSummary } from "@/types/integration";

interface IntegrationState {
  integrations: IntegrationSummary[];
  isLoading: boolean;

  setIntegrations: (items: IntegrationSummary[]) => void;
  addIntegration: (item: IntegrationSummary) => void;
  updateIntegration: (id: string, data: Partial<IntegrationSummary>) => void;
  removeIntegration: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useIntegrationStore = create<IntegrationState>((set) => ({
  integrations: [],
  isLoading: false,

  setIntegrations: (integrations) => set({ integrations }),

  addIntegration: (item) =>
    set((s) => ({ integrations: [item, ...s.integrations] })),

  updateIntegration: (id, data) =>
    set((s) => ({
      integrations: s.integrations.map((i) => (i.id === id ? { ...i, ...data } : i)),
    })),

  removeIntegration: (id) =>
    set((s) => ({
      integrations: s.integrations.filter((i) => i.id !== id),
    })),

  setLoading: (isLoading) => set({ isLoading }),
}));
