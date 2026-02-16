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

  // Open a tab in the unified panel
  const { openTab } = usePanelStore.getState();
  openTab({
    id: `artifact-${artifact.id}`,
    kind: "artifact",
    label: artifact.title,
    artifactId: artifact.id,
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
