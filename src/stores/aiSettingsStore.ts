import { create } from "zustand";

interface AiSettingsState {
  provider: string;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
  planningEnabled: boolean;

  setProvider: (provider: string) => void;
  toggleThinking: () => void;
  toggleWebSearch: () => void;
  setWebSearchEnabled: (enabled: boolean) => void;
  togglePlanning: () => void;
}

export const useAiSettingsStore = create<AiSettingsState>((set) => ({
  provider: "default",
  thinkingEnabled: false,
  webSearchEnabled: true,
  planningEnabled: false,

  setProvider: (provider) => set({ provider }),
  toggleThinking: () => set((s) => ({ thinkingEnabled: !s.thinkingEnabled })),
  toggleWebSearch: () => set((s) => ({ webSearchEnabled: !s.webSearchEnabled })),
  setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),
  togglePlanning: () => set((s) => ({ planningEnabled: !s.planningEnabled })),
}));
