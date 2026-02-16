import { create } from "zustand";

export type PanelTabKind = "artifact" | "article";

export interface PanelTab {
  id: string;
  kind: PanelTabKind;
  label: string;
  /** For artifact tabs — the artifact ID to display */
  artifactId?: string;
  /** For article tabs — "criminal_code/188" style key */
  articleKey?: string;
}

const MAX_TABS = 8;

interface PanelState {
  isOpen: boolean;
  tabs: PanelTab[];
  activeTabId: string | null;
  panelWidthPercent: number;

  openTab: (tab: PanelTab) => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  closePanel: () => void;
  closeAll: () => void;
  setPanelWidthPercent: (percent: number) => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  isOpen: false,
  tabs: [],
  activeTabId: null,
  panelWidthPercent: 50,

  openTab: (tab) => {
    const state = get();
    // Check for duplicate — switch to it instead of creating new
    const existing = state.tabs.find((t) => t.id === tab.id);
    if (existing) {
      set({ isOpen: true, activeTabId: existing.id });
      return;
    }

    // Enforce max tabs — remove oldest if at limit
    let tabs = [...state.tabs];
    if (tabs.length >= MAX_TABS) {
      tabs = tabs.slice(1);
    }

    tabs.push(tab);
    set({ isOpen: true, tabs, activeTabId: tab.id });
  },

  closeTab: (tabId) => {
    const state = get();
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    const tabs = state.tabs.filter((t) => t.id !== tabId);

    // Closing last tab → close panel
    if (tabs.length === 0) {
      set({ isOpen: false, tabs: [], activeTabId: null });
      return;
    }

    // If closing active tab, switch to neighbor
    let activeTabId = state.activeTabId;
    if (activeTabId === tabId) {
      const newIdx = Math.min(idx, tabs.length - 1);
      activeTabId = tabs[newIdx].id;
    }

    set({ tabs, activeTabId });
  },

  switchTab: (tabId) => {
    if (get().tabs.some((t) => t.id === tabId)) {
      set({ activeTabId: tabId });
    }
  },

  closePanel: () => set({ isOpen: false, tabs: [], activeTabId: null }),

  closeAll: () => set({ isOpen: false, tabs: [], activeTabId: null }),

  setPanelWidthPercent: (panelWidthPercent) => set({ panelWidthPercent }),
}));
