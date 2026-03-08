"use client";

import { FileText } from "lucide-react";
import { openSourceInPanel } from "@/lib/panel-actions";

const FILE_ICONS: Record<string, string> = {
  pdf: "PDF",
  docx: "DOCX",
  xlsx: "XLSX",
  csv: "CSV",
  txt: "TXT",
  html: "HTML",
};

interface SourceLinkProps {
  domain: string;
  sourceFile: string;
  chunkIndex: number;
  children?: React.ReactNode;
}

export function SourceLink({ domain, sourceFile, chunkIndex, children }: SourceLinkProps) {
  const ext = sourceFile.includes(".") ? sourceFile.split(".").pop()?.toLowerCase() || "" : "";
  const badge = FILE_ICONS[ext] || "SRC";

  const label = children || sourceFile;

  return (
    <button
      type="button"
      onClick={() => openSourceInPanel(domain, sourceFile, chunkIndex)}
      className="text-accent hover:text-accent/80 underline decoration-accent/40 hover:decoration-accent cursor-pointer inline-flex items-center gap-0.5 transition-colors"
    >
      <span className="text-[0.7em] font-mono bg-accent/10 rounded px-0.5 leading-none">{badge}</span>
      {label}
    </button>
  );
}
