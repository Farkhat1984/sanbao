import { describe, it, expect, beforeEach } from "vitest";
import { useArtifactStore } from "@/stores/artifactStore";
import type { ArtifactData } from "@/types/chat";

function makeArtifact(overrides: Partial<ArtifactData> = {}): ArtifactData {
  return {
    id: "art-1",
    type: "DOCUMENT",
    title: "Test Document",
    content: "Original content",
    version: 1,
    ...overrides,
  };
}

describe("artifactStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useArtifactStore.setState({
      activeArtifact: null,
      activeTab: "preview",
      artifacts: [],
      downloadFormat: "docx",
    });
  });

  // ═══ openArtifact ═════════════════════════════════════

  describe("openArtifact", () => {
    it("should set active artifact", () => {
      const art = makeArtifact();
      useArtifactStore.getState().openArtifact(art);

      const state = useArtifactStore.getState();
      expect(state.activeArtifact).not.toBeNull();
      expect(state.activeArtifact!.title).toBe("Test Document");
    });

    it("should set preview tab for documents", () => {
      useArtifactStore.getState().openArtifact(makeArtifact({ type: "DOCUMENT" }));
      expect(useArtifactStore.getState().activeTab).toBe("preview");
    });

    it("should set source tab for code", () => {
      useArtifactStore.getState().openArtifact(makeArtifact({ type: "CODE" }));
      expect(useArtifactStore.getState().activeTab).toBe("source");
    });

    it("should track artifact in the list", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      expect(useArtifactStore.getState().artifacts).toHaveLength(1);
    });

    it("should initialize version history", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      const stored = useArtifactStore.getState().artifacts[0];
      expect(stored.versions).toHaveLength(1);
      expect(stored.versions![0].version).toBe(1);
      expect(stored.versions![0].content).toBe("Original content");
    });
  });

  // ═══ trackArtifact ════════════════════════════════════

  describe("trackArtifact", () => {
    it("should add new artifact", () => {
      const result = useArtifactStore.getState().trackArtifact(makeArtifact());
      expect(result.title).toBe("Test Document");
      expect(useArtifactStore.getState().artifacts).toHaveLength(1);
    });

    it("should return existing artifact by ID", () => {
      useArtifactStore.getState().trackArtifact(makeArtifact());
      const result = useArtifactStore.getState().trackArtifact(makeArtifact());
      expect(useArtifactStore.getState().artifacts).toHaveLength(1);
      expect(result.title).toBe("Test Document");
    });

    it("should merge by title if different ID but same title", () => {
      useArtifactStore.getState().trackArtifact(makeArtifact());
      const updated = useArtifactStore.getState().trackArtifact(
        makeArtifact({ id: "art-2", content: "Updated content" })
      );

      expect(useArtifactStore.getState().artifacts).toHaveLength(1);
      expect(updated.content).toBe("Updated content");
      expect(updated.version).toBe(2);
    });

    it("should not bump version when content is the same", () => {
      useArtifactStore.getState().trackArtifact(makeArtifact());
      const result = useArtifactStore.getState().trackArtifact(
        makeArtifact({ id: "art-2" }) // same title, same content
      );
      expect(result.version).toBe(1); // no bump
    });

    it("should track multiple artifacts with different titles", () => {
      useArtifactStore.getState().trackArtifact(makeArtifact({ id: "a1", title: "Doc A" }));
      useArtifactStore.getState().trackArtifact(makeArtifact({ id: "a2", title: "Doc B" }));
      expect(useArtifactStore.getState().artifacts).toHaveLength(2);
    });

    it("should do case-insensitive title matching", () => {
      useArtifactStore.getState().trackArtifact(makeArtifact({ title: "My Document" }));
      const result = useArtifactStore.getState().trackArtifact(
        makeArtifact({ id: "art-2", title: "my document", content: "new" })
      );
      expect(useArtifactStore.getState().artifacts).toHaveLength(1);
      expect(result.content).toBe("new");
    });
  });

  // ═══ findByTitle ══════════════════════════════════════

  describe("findByTitle", () => {
    it("should find artifact by exact title", () => {
      useArtifactStore.getState().trackArtifact(makeArtifact({ title: "Contract A" }));
      const found = useArtifactStore.getState().findByTitle("Contract A");
      expect(found).toBeDefined();
      expect(found!.title).toBe("Contract A");
    });

    it("should find artifact case-insensitively", () => {
      useArtifactStore.getState().trackArtifact(makeArtifact({ title: "Legal Analysis" }));
      const found = useArtifactStore.getState().findByTitle("legal analysis");
      expect(found).toBeDefined();
    });

    it("should return undefined if not found", () => {
      const found = useArtifactStore.getState().findByTitle("Nonexistent");
      expect(found).toBeUndefined();
    });
  });

  // ═══ updateContent ════════════════════════════════════

  describe("updateContent", () => {
    it("should update content and bump version", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      useArtifactStore.getState().updateContent("art-1", "New content");

      const art = useArtifactStore.getState().artifacts[0];
      expect(art.content).toBe("New content");
      expect(art.version).toBe(2);
    });

    it("should push previous version to history", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      useArtifactStore.getState().updateContent("art-1", "Version 2");

      const art = useArtifactStore.getState().artifacts[0];
      expect(art.versions).toHaveLength(2);
      expect(art.versions![0].content).toBe("Original content");
      expect(art.versions![1].content).toBe("Original content"); // pushVersion saves current before update
    });

    it("should update active artifact if it matches", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      useArtifactStore.getState().updateContent("art-1", "Updated");

      expect(useArtifactStore.getState().activeArtifact!.content).toBe("Updated");
    });

    it("should not update active artifact if ID differs", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      useArtifactStore.getState().trackArtifact(makeArtifact({ id: "art-2", title: "Other" }));
      useArtifactStore.getState().updateContent("art-2", "Changed");

      expect(useArtifactStore.getState().activeArtifact!.content).toBe("Original content");
    });

    it("should ignore unknown ID", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      useArtifactStore.getState().updateContent("nonexistent", "X");
      expect(useArtifactStore.getState().artifacts[0].content).toBe("Original content");
    });
  });

  // ═══ applyEdits ═══════════════════════════════════════

  describe("applyEdits", () => {
    it("should apply search/replace edits", () => {
      useArtifactStore.getState().openArtifact(makeArtifact({ content: "Hello world" }));
      const result = useArtifactStore.getState().applyEdits("art-1", [
        { old: "world", new: "universe" },
      ]);

      expect(result).toBe(true);
      expect(useArtifactStore.getState().artifacts[0].content).toBe("Hello universe");
    });

    it("should bump version on successful edit", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      useArtifactStore.getState().applyEdits("art-1", [
        { old: "Original", new: "Modified" },
      ]);
      expect(useArtifactStore.getState().artifacts[0].version).toBe(2);
    });

    it("should apply multiple edits in sequence", () => {
      useArtifactStore.getState().openArtifact(
        makeArtifact({ content: "AAA BBB CCC" })
      );
      useArtifactStore.getState().applyEdits("art-1", [
        { old: "AAA", new: "XXX" },
        { old: "CCC", new: "ZZZ" },
      ]);
      expect(useArtifactStore.getState().artifacts[0].content).toBe("XXX BBB ZZZ");
    });

    it("should return false if no edits matched", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      const result = useArtifactStore.getState().applyEdits("art-1", [
        { old: "nonexistent text", new: "replacement" },
      ]);
      expect(result).toBe(false);
    });

    it("should return false for unknown artifact ID", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      const result = useArtifactStore.getState().applyEdits("nonexistent", [
        { old: "a", new: "b" },
      ]);
      expect(result).toBe(false);
    });

    it("should update active artifact if open", () => {
      useArtifactStore.getState().openArtifact(makeArtifact({ content: "test data" }));
      useArtifactStore.getState().applyEdits("art-1", [
        { old: "test", new: "real" },
      ]);
      expect(useArtifactStore.getState().activeArtifact!.content).toBe("real data");
    });

    it("should save previous version in history", () => {
      useArtifactStore.getState().openArtifact(makeArtifact({ content: "v1" }));
      useArtifactStore.getState().applyEdits("art-1", [{ old: "v1", new: "v2" }]);

      const versions = useArtifactStore.getState().artifacts[0].versions!;
      expect(versions.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ═══ restoreVersion ═══════════════════════════════════

  describe("restoreVersion", () => {
    it("should restore to a previous version", () => {
      useArtifactStore.getState().openArtifact(makeArtifact({ content: "Version 1" }));
      useArtifactStore.getState().updateContent("art-1", "Version 2");
      useArtifactStore.getState().restoreVersion("art-1", 1);

      expect(useArtifactStore.getState().artifacts[0].content).toBe("Version 1");
      expect(useArtifactStore.getState().artifacts[0].version).toBe(1);
    });

    it("should update active artifact on restore", () => {
      useArtifactStore.getState().openArtifact(makeArtifact({ content: "V1" }));
      useArtifactStore.getState().updateContent("art-1", "V2");
      useArtifactStore.getState().restoreVersion("art-1", 1);

      expect(useArtifactStore.getState().activeArtifact!.content).toBe("V1");
    });

    it("should do nothing for unknown artifact", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      useArtifactStore.getState().restoreVersion("nonexistent", 1);
      expect(useArtifactStore.getState().artifacts[0].content).toBe("Original content");
    });

    it("should do nothing for unknown version number", () => {
      useArtifactStore.getState().openArtifact(makeArtifact());
      useArtifactStore.getState().restoreVersion("art-1", 99);
      expect(useArtifactStore.getState().artifacts[0].content).toBe("Original content");
    });
  });

  // ═══ setDownloadFormat ════════════════════════════════

  describe("setDownloadFormat", () => {
    it("should change download format", () => {
      expect(useArtifactStore.getState().downloadFormat).toBe("docx");
      useArtifactStore.getState().setDownloadFormat("pdf");
      expect(useArtifactStore.getState().downloadFormat).toBe("pdf");
    });

    it("should accept all new formats", () => {
      const formats = ["docx", "pdf", "txt", "xlsx", "html", "md"] as const;
      for (const fmt of formats) {
        useArtifactStore.getState().setDownloadFormat(fmt);
        expect(useArtifactStore.getState().downloadFormat).toBe(fmt);
      }
    });
  });

  // ═══ setTab ═══════════════════════════════════════════

  describe("setTab", () => {
    it("should change active tab", () => {
      useArtifactStore.getState().setTab("edit");
      expect(useArtifactStore.getState().activeTab).toBe("edit");
    });

    it("should support all tab values", () => {
      for (const tab of ["preview", "edit", "source"] as const) {
        useArtifactStore.getState().setTab(tab);
        expect(useArtifactStore.getState().activeTab).toBe(tab);
      }
    });
  });

  // ═══ setArtifacts ═════════════════════════════════════

  describe("setArtifacts", () => {
    it("should replace entire artifacts array", () => {
      useArtifactStore.getState().trackArtifact(makeArtifact());
      expect(useArtifactStore.getState().artifacts).toHaveLength(1);

      useArtifactStore.getState().setArtifacts([]);
      expect(useArtifactStore.getState().artifacts).toHaveLength(0);
    });
  });
});
