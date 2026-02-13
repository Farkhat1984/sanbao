"use client";

import { X, Download, Copy, Printer, Check } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useArtifactStore } from "@/stores/artifactStore";
import { ArtifactTabs } from "./ArtifactTabs";
import { DocumentPreview } from "./DocumentPreview";
import { DocumentEditor } from "./DocumentEditor";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

const TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Договор",
  CLAIM: "Иск",
  COMPLAINT: "Жалоба",
  DOCUMENT: "Документ",
  CODE: "Код",
  ANALYSIS: "Анализ",
};

export function ArtifactPanel() {
  const { activeArtifact, activeTab, setTab, closePanel, updateContent } =
    useArtifactStore();
  const [copied, setCopied] = useState(false);

  if (!activeArtifact) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeArtifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeArtifact.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeArtifact.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-surface w-[480px]">
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
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleDownload}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
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

      {/* Tabs */}
      <ArtifactTabs activeTab={activeTab} onTabChange={setTab} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="h-full"
        >
          {activeTab === "preview" && (
            <DocumentPreview content={activeArtifact.content} />
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
        </motion.div>
      </div>
    </div>
  );
}
