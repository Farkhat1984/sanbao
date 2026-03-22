import { create } from "zustand";

export type PanelTabKind = "artifact" | "article" | "image" | "source";

export interface PanelTab {
  id: string;
  kind: PanelTabKind;
  label: string;
  /** For artifact tabs — the artifact ID to display */
  artifactId?: string;
  /** For article tabs — "criminal_code/188" style key */
  articleKey?: string;
  /** For image tabs — the image URL */
  imageSrc?: string;
  /** For source tabs — "domain/file.pdf/3" style key */
  sourceKey?: string;
}

const MAX_TABS = 8;

const PANEL_WIDTH_KEY = "sanbao_panel_width";
const DEFAULT_PANEL_WIDTH = 50;
const MIN_PANEL_WIDTH = 25;
const MAX_PANEL_WIDTH = 75;

const getInitialWidth = (): number => {
  if (typeof window === "undefined") return DEFAULT_PANEL_WIDTH;
  const stored = localStorage.getItem(PANEL_WIDTH_KEY);
  if (!stored) return DEFAULT_PANEL_WIDTH;
  const parsed = parseInt(stored, 10);
  return Number.isFinite(parsed)
    ? Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, parsed))
    : DEFAULT_PANEL_WIDTH;
};

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
  panelWidthPercent: getInitialWidth(),

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

  setPanelWidthPercent: (percent) => {
    const clamped = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, percent));
    if (typeof window !== "undefined") {
      localStorage.setItem(PANEL_WIDTH_KEY, String(clamped));
    }
    set({ panelWidthPercent: clamped });
  },
}));
