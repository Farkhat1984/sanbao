import { create } from "zustand";
import type { UserMemory } from "@/types/memory";

interface MemoryState {
  memories: UserMemory[];
  isLoading: boolean;

  setMemories: (memories: UserMemory[]) => void;
  addMemory: (memory: UserMemory) => void;
  updateMemory: (id: string, data: Partial<UserMemory>) => void;
  removeMemory: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  memories: [],
  isLoading: false,

  setMemories: (memories) => set({ memories }),

  addMemory: (memory) =>
    set((s) => ({ memories: [memory, ...s.memories] })),

  updateMemory: (id, data) =>
    set((s) => ({
      memories: s.memories.map((m) =>
        m.id === id ? { ...m, ...data } : m
      ),
    })),

  removeMemory: (id) =>
    set((s) => ({
      memories: s.memories.filter((m) => m.id !== id),
    })),

  setLoading: (isLoading) => set({ isLoading }),
}));
