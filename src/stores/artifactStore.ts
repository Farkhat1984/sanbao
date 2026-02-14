import { create } from "zustand";
import type { ArtifactData } from "@/types/chat";
import type { ExportFormat } from "@/lib/export-utils";

type ArtifactTab = "preview" | "edit" | "source";

interface ArtifactState {
  isOpen: boolean;
  activeArtifact: ArtifactData | null;
  activeTab: ArtifactTab;
  artifacts: ArtifactData[];
  downloadFormat: ExportFormat;
  panelWidthPercent: number;
  openArtifact: (artifact: ArtifactData) => void;
  closePanel: () => void;
  setTab: (tab: ArtifactTab) => void;
  updateContent: (id: string, content: string) => void;
  setArtifacts: (artifacts: ArtifactData[]) => void;
  setDownloadFormat: (format: ExportFormat) => void;
  setPanelWidthPercent: (percent: number) => void;
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  isOpen: false,
  activeArtifact: null,
  activeTab: "preview",
  artifacts: [],
  downloadFormat: "docx",
  panelWidthPercent: 50,

  openArtifact: (artifact) =>
    set({
      isOpen: true,
      activeArtifact: artifact,
      activeTab: artifact.type === "CODE" ? "source" : "preview",
    }),

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

  setDownloadFormat: (downloadFormat) => set({ downloadFormat }),

  setPanelWidthPercent: (panelWidthPercent) => set({ panelWidthPercent }),
}));
