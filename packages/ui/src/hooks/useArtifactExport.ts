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
 * Request a screenshot from the iframe via postMessage.
 * The iframe has a `capture-screenshot` handler that returns a data URL.
 */
function captureIframeScreenshot(previewRef: RefObject<HTMLDivElement | null>): Promise<string | null> {
  return new Promise((resolve) => {
    const iframe = previewRef.current?.querySelector("iframe") as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) {
      resolve(null);
      return;
    }

    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, 5000);

    function handler(e: MessageEvent) {
      if (!e.data || e.data.type !== "screenshot-result") return;
      window.removeEventListener("message", handler);
      clearTimeout(timeout);
      resolve(e.data.dataUrl || null);
    }

    window.addEventListener("message", handler);
    iframe.contentWindow.postMessage({ type: "capture-screenshot" }, "*");
  });
}

/**
 * Request text output from the iframe via postMessage.
 * The iframe returns its #output textContent (Python print() results).
 */
function captureIframeTextOutput(previewRef: RefObject<HTMLDivElement | null>): Promise<string | null> {
  return new Promise((resolve) => {
    const iframe = previewRef.current?.querySelector("iframe") as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) {
      resolve(null);
      return;
    }

    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, 3000);

    function handler(e: MessageEvent) {
      if (!e.data || e.data.type !== "text-output-result") return;
      window.removeEventListener("message", handler);
      clearTimeout(timeout);
      resolve(e.data.text || null);
    }

    window.addEventListener("message", handler);
    iframe.contentWindow.postMessage({ type: "capture-text-output" }, "*");
  });
}

/**
 * Encapsulates all download/export logic for artifacts.
 * Supports IMAGE (PNG), CODE (.py/.tsx + screenshot PNG), and document formats (DOCX, PDF, TXT, XLSX, HTML, MD).
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

      // CODE type: download source code, screenshot, or data based on format
      if (artifact.type === "CODE") {
        if (downloadFormat === "png") {
          // Screenshot as PNG from iframe
          if (activeTab !== "preview") {
            setTab("preview");
            await new Promise<void>((r) => setTimeout(r, 500));
          }
          const dataUrl = await captureIframeScreenshot(previewRef);
          if (dataUrl) {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `${sanitizeFilename(artifact.title)}.png`;
            a.click();
          } else {
            // Fallback: download source code
            const ext = isPythonCode(artifact.content) ? ".py" : ".tsx";
            exportAsText(artifact.content, artifact.title, ext);
          }
          return;
        }
        if (downloadFormat === "xlsx") {
          // Extract text output from iframe and export as xlsx
          if (activeTab !== "preview") {
            setTab("preview");
            await new Promise<void>((r) => setTimeout(r, 500));
          }
          const textData = await captureIframeTextOutput(previewRef);
          if (textData) {
            exportAsXlsx(textData, artifact.title);
          } else {
            // Fallback: export source code as text
            exportAsText(artifact.content, artifact.title, ".txt");
          }
          return;
        }
        // Default (txt): download source code
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
