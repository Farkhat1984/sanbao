import { create } from "zustand";

interface SidebarState {
  isOpen: boolean;
  searchQuery: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setSearchQuery: (q: string) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: true,
  searchQuery: "",
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
