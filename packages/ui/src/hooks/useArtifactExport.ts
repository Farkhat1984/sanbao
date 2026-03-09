import { useState, useCallback, type RefObject } from "react";
import { isPythonCode } from "@/components/artifacts/CodePreview";
import { markdownToDocx } from "@/lib/export-docx";
import { exportToPdf } from "@/lib/export-pdf";
import { exportAsText, exportAsHtml, exportAsMarkdown, sanitizeFilename } from "@/lib/export-utils";
import { exportAsXlsx } from "@/lib/export-xlsx";
import type { ExportFormat } from "@/lib/export-utils";
import type { ArtifactType } from "@/types/chat";

interface Artifact {
  id: string;
  title: string;
  content: string;
  type: string;
}

interface UseArtifactExportOptions {
  artifact: Artifact | null;
  previewRef: RefObject<HTMLDivElement | null>;
  activeTab: string;
  setTab: (tab: "preview" | "edit" | "source") => void;
  downloadFormat: ExportFormat;
}

/**
 * Encapsulates all download/export logic for artifacts.
 * Supports IMAGE (PNG), CODE (.py/.tsx), and document formats (DOCX, PDF, TXT, XLSX, HTML, MD).
 */
export function useArtifactExport({ artifact, previewRef, activeTab, setTab, downloadFormat }: UseArtifactExportOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!artifact) return;
    setIsExporting(true);
    try {
      // IMAGE type: download as PNG directly
      if (artifact.type === "IMAGE") {
        const a = document.createElement("a");
        a.href = artifact.content;
        a.download = `${sanitizeFilename(artifact.title)}.png`;
        a.click();
        return;
      }

      // CODE type: download as .py or .tsx
      if (artifact.type === "CODE") {
        const ext = isPythonCode(artifact.content) ? ".py" : ".tsx";
        exportAsText(artifact.content, artifact.title, ext);
        return;
      }

      switch (downloadFormat) {
        case "docx": {
          const { saveAs } = await import("file-saver");
          const blob = await markdownToDocx(
            artifact.content,
            artifact.title,
            artifact.type as ArtifactType
          );
          saveAs(blob, `${sanitizeFilename(artifact.title)}.docx`);
          break;
        }
        case "pdf": {
          // Switch to preview tab so the DOM element is rendered
          if (activeTab !== "preview") {
            setTab("preview");
            await new Promise<void>((resolve) => {
              const check = () => {
                if (previewRef.current) resolve();
                else requestAnimationFrame(check);
              };
              requestAnimationFrame(check);
              setTimeout(resolve, 1000);
            });
          }
          if (previewRef.current) {
            await exportToPdf(previewRef.current, artifact.title);
          }
          break;
        }
        case "txt": {
          exportAsText(artifact.content, artifact.title);
          break;
        }
        case "xlsx": {
          exportAsXlsx(artifact.content, artifact.title);
          break;
        }
        case "html": {
          exportAsHtml(artifact.content, artifact.title);
          break;
        }
        case "md": {
          exportAsMarkdown(artifact.content, artifact.title);
          break;
        }
      }
    } finally {
      setIsExporting(false);
    }
  }, [artifact, downloadFormat, activeTab, setTab, previewRef]);

  return { isExporting, handleDownload };
}
