import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  isOpen: boolean;
  searchQuery: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setSearchQuery: (q: string) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      searchQuery: "",
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
    }),
    {
      name: "sanbao-sidebar",
      partialize: (state) => ({ isOpen: state.isOpen }),
    }
  )
);
