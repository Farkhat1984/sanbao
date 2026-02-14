"use client";

import { X, Download, Copy, Printer, Check, Loader2, ChevronDown } from "lucide-react";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useArtifactStore } from "@/stores/artifactStore";
import { ArtifactTabs } from "./ArtifactTabs";
import { DocumentPreview } from "./DocumentPreview";
import { DocumentEditor } from "./DocumentEditor";
import { CodePreview } from "./CodePreview";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { markdownToDocx } from "@/lib/export-docx";
import { exportToPdf } from "@/lib/export-pdf";
import { exportAsText, sanitizeFilename } from "@/lib/export-utils";
import type { ExportFormat } from "@/lib/export-utils";
import type { ArtifactType } from "@/types/chat";

const TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Договор",
  CLAIM: "Иск",
  COMPLAINT: "Жалоба",
  DOCUMENT: "Документ",
  CODE: "Код",
  ANALYSIS: "Анализ",
  IMAGE: "Изображение",
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  docx: "DOCX",
  pdf: "PDF",
  txt: "TXT",
};

export function ArtifactPanel() {
  const {
    activeArtifact,
    activeTab,
    setTab,
    closePanel,
    updateContent,
    downloadFormat,
    setDownloadFormat,
  } = useArtifactStore();
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  if (!activeArtifact) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeArtifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      // IMAGE type: download as PNG directly
      if (activeArtifact.type === "IMAGE") {
        const a = document.createElement("a");
        a.href = activeArtifact.content;
        a.download = `${sanitizeFilename(activeArtifact.title)}.png`;
        a.click();
        return;
      }

      // CODE type: download as .tsx
      if (activeArtifact.type === "CODE") {
        exportAsText(activeArtifact.content, activeArtifact.title, ".tsx");
        return;
      }

      switch (downloadFormat) {
        case "docx": {
          const { saveAs } = await import("file-saver");
          const blob = await markdownToDocx(
            activeArtifact.content,
            activeArtifact.title,
            activeArtifact.type as ArtifactType
          );
          saveAs(blob, `${sanitizeFilename(activeArtifact.title)}.docx`);
          break;
        }
        case "pdf": {
          // Switch to preview tab so the DOM element is rendered
          if (activeTab !== "preview") {
            setTab("preview");
            await new Promise((r) => setTimeout(r, 300));
          }
          if (previewRef.current) {
            await exportToPdf(previewRef.current, activeArtifact.title);
          }
          break;
        }
        case "txt": {
          exportAsText(activeArtifact.content, activeArtifact.title);
          break;
        }
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleSelectFormat = (format: ExportFormat) => {
    setDownloadFormat(format);
    setFormatMenuOpen(false);
  };

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="h-14 flex items-center gap-2 px-4 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {activeArtifact.title}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="legal" className="text-[10px]">
              {TYPE_LABELS[activeArtifact.type] || activeArtifact.type}
            </Badge>
            <span className="text-[10px] text-text-muted">
              v{activeArtifact.version}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Format selector + Download */}
          {activeArtifact.type === "IMAGE" || activeArtifact.type === "CODE" ? (
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="h-7 px-2 rounded-lg border border-border flex items-center justify-center gap-1 text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>{activeArtifact.type === "IMAGE" ? "PNG" : "TSX"}</span>
                </>
              )}
            </button>
          ) : (
            <div className="relative flex items-center">
              <button
                onClick={() => setFormatMenuOpen(!formatMenuOpen)}
                className="h-7 pl-2 pr-1 rounded-l-lg border border-border bg-surface-alt text-[11px] text-text-primary flex items-center gap-0.5 hover:bg-surface transition-colors cursor-pointer"
              >
                {FORMAT_LABELS[downloadFormat]}
                <ChevronDown className="h-3 w-3 text-text-muted" />
              </button>
              <button
                onClick={handleDownload}
                disabled={isExporting}
                className="h-7 px-2 rounded-r-lg border border-l-0 border-border flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Format dropdown */}
              {formatMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setFormatMenuOpen(false)}
                  />
                  <div className="absolute top-full right-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-lg overflow-hidden min-w-[120px]">
                    {(["docx", "pdf", "txt"] as ExportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => handleSelectFormat(fmt)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs hover:bg-surface-alt transition-colors cursor-pointer flex items-center justify-between",
                          downloadFormat === fmt &&
                            "text-accent font-medium bg-accent-light"
                        )}
                      >
                        <span>
                          {fmt === "docx" && "Word (.docx)"}
                          {fmt === "pdf" && "PDF (.pdf)"}
                          {fmt === "txt" && "Текст (.txt)"}
                        </span>
                        {downloadFormat === fmt && (
                          <Check className="h-3 w-3 text-accent" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => window.print()}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={closePanel}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs (hidden for IMAGE) */}
      {activeArtifact.type !== "IMAGE" && (
        <ArtifactTabs activeTab={activeTab} onTabChange={setTab} artifactType={activeArtifact.type as ArtifactType} />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="h-full"
        >
          {activeArtifact.type === "IMAGE" ? (
            <div className="h-full flex items-center justify-center p-4 bg-surface-alt">
              <img
                src={activeArtifact.content}
                alt={activeArtifact.title}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
              />
            </div>
          ) : activeArtifact.type === "CODE" ? (
            <>
              {activeTab === "source" && (
                <pre className="p-4 text-xs font-mono text-text-secondary whitespace-pre-wrap leading-relaxed overflow-auto h-full">
                  <code>{activeArtifact.content}</code>
                </pre>
              )}
              {activeTab === "preview" && (
                <CodePreview code={activeArtifact.content} />
              )}
              {activeTab === "edit" && (
                <DocumentEditor
                  content={activeArtifact.content}
                  onChange={(content) =>
                    updateContent(activeArtifact.id, content)
                  }
                />
              )}
            </>
          ) : (
            <>
              {activeTab === "preview" && (
                <DocumentPreview ref={previewRef} content={activeArtifact.content} />
              )}
              {activeTab === "edit" && (
                <DocumentEditor
                  content={activeArtifact.content}
                  onChange={(content) =>
                    updateContent(activeArtifact.id, content)
                  }
                />
              )}
              {activeTab === "source" && (
                <pre className="p-4 text-xs font-mono text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {activeArtifact.content}
                </pre>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
