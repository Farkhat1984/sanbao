import { create } from "zustand";
import type { ArtifactData, ArtifactVersion } from "@/types/chat";
import type { ExportFormat } from "@/lib/export-utils";

type ArtifactTab = "preview" | "edit" | "source";

/** Push current state into the versions history array. */
function pushVersion(artifact: ArtifactData): ArtifactVersion[] {
  const prev: ArtifactVersion[] = artifact.versions ?? [];
  return [
    ...prev,
    { version: artifact.version, content: artifact.content, timestamp: Date.now() },
  ];
}

interface ArtifactState {
  activeArtifact: ArtifactData | null;
  activeTab: ArtifactTab;
  artifacts: ArtifactData[];
  downloadFormat: ExportFormat;

  openArtifact: (artifact: ArtifactData) => void;
  setTab: (tab: ArtifactTab) => void;
  updateContent: (id: string, content: string) => void;
  setArtifacts: (artifacts: ArtifactData[]) => void;
  setDownloadFormat: (format: ExportFormat) => void;

  /** Register or update an artifact in the tracked list. Returns the stored artifact. */
  trackArtifact: (artifact: ArtifactData) => ArtifactData;
  /** Find a tracked artifact by title (case-insensitive). */
  findByTitle: (title: string) => ArtifactData | undefined;
  /** Apply search/replace edits to an artifact, increment version, update panel if open. */
  applyEdits: (id: string, edits: Array<{ old: string; new: string }>) => boolean;
  /** Restore a previous version of an artifact by version number. */
  restoreVersion: (id: string, version: number) => void;
}

export const useArtifactStore = create<ArtifactState>((set, get) => ({
  activeArtifact: null,
  activeTab: "preview",
  artifacts: [],
  downloadFormat: "docx",

  openArtifact: (artifact) => {
    // Track + set activeArtifact (data-only, no panel UI)
    const tracked = get().trackArtifact(artifact);
    set({
      activeArtifact: tracked,
      activeTab: tracked.type === "CODE" ? "source" : "preview",
    });
  },

  setTab: (activeTab) => set({ activeTab }),

  updateContent: (id, content) =>
    set((s) => {
      const updated = s.artifacts.map((a) => {
        if (a.id !== id) return a;
        return {
          ...a,
          content,
          version: a.version + 1,
          versions: pushVersion(a),
        };
      });
      const updatedArtifact = updated.find((a) => a.id === id);
      return {
        artifacts: updated,
        activeArtifact:
          s.activeArtifact?.id === id && updatedArtifact
            ? updatedArtifact
            : s.activeArtifact,
      };
    }),

  setArtifacts: (artifacts) => set({ artifacts }),

  setDownloadFormat: (downloadFormat) => set({ downloadFormat }),

  trackArtifact: (artifact) => {
    const state = get();
    const existing = state.artifacts.find((a) => a.id === artifact.id);
    if (existing) return existing;

    // Check if same title exists — update it
    const byTitle = state.artifacts.find(
      (a) => a.title.toLowerCase() === artifact.title.toLowerCase()
    );
    if (byTitle) {
      // If content is the same, just return existing (no version bump)
      if (byTitle.content === artifact.content) return byTitle;

      const merged = {
        ...byTitle,
        content: artifact.content,
        version: byTitle.version + 1,
        versions: pushVersion(byTitle),
      };
      set((s) => ({
        artifacts: s.artifacts.map((a) => (a.id === byTitle.id ? merged : a)),
        activeArtifact: s.activeArtifact?.id === byTitle.id ? merged : s.activeArtifact,
      }));
      return merged;
    }

    // New artifact — versions start empty; pushVersion will capture
    // the initial state when the first update arrives.
    const fresh = { ...artifact, versions: [] };
    set((s) => {
      const updated = [...s.artifacts, fresh];
      // Cap at 50 artifacts to prevent unbounded growth
      return { artifacts: updated.length > 50 ? updated.slice(-50) : updated };
    });
    return fresh;
  },

  findByTitle: (title) => {
    return get().artifacts.find(
      (a) => a.title.toLowerCase() === title.toLowerCase()
    );
  },

  applyEdits: (id, edits) => {
    const state = get();
    const artifact = state.artifacts.find((a) => a.id === id);
    if (!artifact) return false;

    let content = artifact.content;
    for (const edit of edits) {
      // Try exact match first
      if (content.includes(edit.old)) {
        content = content.replace(edit.old, edit.new);
        continue;
      }
      // Fallback: normalize whitespace and try again
      const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
      const normalizedOld = normalize(edit.old);
      // Find the matching region in original content by normalizing segments
      const lines = content.split("\n");
      let found = false;
      // Try sliding window over lines to find normalized match
      for (let start = 0; start < lines.length && !found; start++) {
        for (let end = start + 1; end <= lines.length && !found; end++) {
          const segment = lines.slice(start, end).join("\n");
          if (normalize(segment) === normalizedOld) {
            content = content.replace(segment, edit.new);
            found = true;
          }
        }
      }
    }

    if (content === artifact.content) return false;

    const updated = {
      ...artifact,
      content,
      version: artifact.version + 1,
      versions: pushVersion(artifact),
    };
    set((s) => ({
      artifacts: s.artifacts.map((a) => (a.id === id ? updated : a)),
      activeArtifact: s.activeArtifact?.id === id ? updated : s.activeArtifact,
    }));
    return true;
  },

  restoreVersion: (id, version) => {
    const state = get();
    const artifact = state.artifacts.find((a) => a.id === id);
    if (!artifact || !artifact.versions) return;
    if (artifact.version === version) return; // already on this version

    const target = artifact.versions.find((v) => v.version === version);
    if (!target) return;

    // Save current state before restoring, so user can return to it
    const currentAlreadySaved = artifact.versions.some(
      (v) => v.version === artifact.version
    );
    const versions = currentAlreadySaved
      ? artifact.versions
      : [...artifact.versions, { version: artifact.version, content: artifact.content, timestamp: Date.now() }];

    const restored = {
      ...artifact,
      content: target.content,
      version: target.version,
      versions,
    };

    set((s) => ({
      artifacts: s.artifacts.map((a) => (a.id === id ? restored : a)),
      activeArtifact: s.activeArtifact?.id === id ? restored : s.activeArtifact,
    }));
  },
}));
