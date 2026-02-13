import { create } from "zustand";
import type { ArtifactData } from "@/types/chat";

type ArtifactTab = "preview" | "edit" | "source";

interface ArtifactState {
  isOpen: boolean;
  activeArtifact: ArtifactData | null;
  activeTab: ArtifactTab;
  artifacts: ArtifactData[];
  openArtifact: (artifact: ArtifactData) => void;
  closePanel: () => void;
  setTab: (tab: ArtifactTab) => void;
  updateContent: (id: string, content: string) => void;
  setArtifacts: (artifacts: ArtifactData[]) => void;
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  isOpen: false,
  activeArtifact: null,
  activeTab: "preview",
  artifacts: [],

  openArtifact: (artifact) =>
    set({ isOpen: true, activeArtifact: artifact, activeTab: "preview" }),

  closePanel: () =>
    set({ isOpen: false, activeArtifact: null }),

  setTab: (activeTab) => set({ activeTab }),

  updateContent: (id, content) =>
    set((s) => ({
      artifacts: s.artifacts.map((a) =>
        a.id === id ? { ...a, content, version: a.version + 1 } : a
      ),
      activeArtifact:
        s.activeArtifact?.id === id
          ? { ...s.activeArtifact, content, version: s.activeArtifact.version + 1 }
          : s.activeArtifact,
    })),

  setArtifacts: (artifacts) => set({ artifacts }),
}));
