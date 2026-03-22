import { create } from "zustand";

interface AiSettingsState {
  provider: string;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
  planningEnabled: boolean;

  setProvider: (provider: string) => void;
  toggleThinking: () => void;
  toggleWebSearch: () => void;
  togglePlanning: () => void;
}

export const useAiSettingsStore = create<AiSettingsState>((set) => ({
  provider: "default",
  thinkingEnabled: false,
  webSearchEnabled: false,
  planningEnabled: false,

  setProvider: (provider) => set({ provider }),
  toggleThinking: () => set((s) => ({ thinkingEnabled: !s.thinkingEnabled })),
  toggleWebSearch: () => set((s) => ({ webSearchEnabled: !s.webSearchEnabled })),
  togglePlanning: () => set((s) => ({ planningEnabled: !s.planningEnabled })),
}));
