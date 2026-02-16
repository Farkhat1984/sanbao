import { useArtifactStore } from "@/stores/artifactStore";
import { useArticleStore } from "@/stores/articleStore";
import { usePanelStore } from "@/stores/panelStore";
import type { ArtifactData } from "@/types/chat";

/**
 * Open an artifact in the unified panel.
 * Calls artifactStore for data tracking, then panelStore for UI.
 */
export function openArtifactInPanel(artifact: ArtifactData) {
  // Track + set activeArtifact in artifact store (data-only)
  const { openArtifact } = useArtifactStore.getState();
  openArtifact(artifact);

  // Use the tracked artifact (may differ from input if matched by title)
  const tracked = useArtifactStore.getState().activeArtifact;
  if (!tracked) return;

  // Open a tab in the unified panel using tracked ID to avoid duplicates
  const { openTab } = usePanelStore.getState();
  openTab({
    id: `artifact-${tracked.id}`,
    kind: "artifact",
    label: tracked.title,
    artifactId: tracked.id,
  });
}

/**
 * Open a legal article in the unified panel.
 * Calls articleStore for fetch+cache, then panelStore for UI.
 */
export function openArticleInPanel(code: string, article: string) {
  // Fetch + cache in article store
  const { openArticle } = useArticleStore.getState();
  openArticle(code, article);

  // Open a tab in the unified panel
  const key = `${code}/${article}`;
  const { openTab } = usePanelStore.getState();
  openTab({
    id: `article-${key}`,
    kind: "article",
    label: `${article}`,
    articleKey: key,
  });
}
