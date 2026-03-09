"use client";

import { FileText, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { useSourceStore } from "@/stores/sourceStore";
import type { SourceChunkContext } from "@/stores/sourceStore";

function ChunkPreview({ chunk, direction }: { chunk: SourceChunkContext; direction: "before" | "after" }) {
  const icon = direction === "before" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  return (
    <div className="px-4 py-2 bg-surface-alt/50 border-l-2 border-border text-xs text-text-secondary">
      <div className="flex items-center gap-1 mb-1 font-medium">
        {icon}
        <span>Chunk #{chunk.chunk_index}</span>
        {chunk.heading_path && <span className="opacity-60">| {chunk.heading_path}</span>}
        {chunk.page_start != null && <span className="opacity-60">| p.{chunk.page_start}</span>}
      </div>
      <p className="whitespace-pre-wrap leading-relaxed">{chunk.text}</p>
    </div>
  );
}

export function SourceContentView() {
  const { activeSource, loading, error } = useSourceStore();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-error font-medium mb-1">Error</p>
          <p className="text-xs text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  if (!activeSource) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-text-secondary">No source selected</p>
      </div>
    );
  }

  const s = activeSource;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-surface border-b border-border px-4 py-3 z-10">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{s.source_file}</p>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="uppercase font-mono">{s.file_type || "?"}</span>
              <span>Chunk {s.chunk_index + 1}/{s.total_chunks}</span>
              {s.page_start != null && <span>Page {s.page_start}{s.page_end && s.page_end !== s.page_start ? `-${s.page_end}` : ""}</span>}
            </div>
          </div>
        </div>
        {s.heading_path && (
          <p className="mt-1 text-xs text-accent/80 font-medium">{s.heading_path}</p>
        )}
      </div>

      {/* Context before */}
      {s.context_before.length > 0 && (
        <div className="space-y-0.5 mt-2">
          {s.context_before.map((c) => (
            <ChunkPreview key={c.chunk_index} chunk={c} direction="before" />
          ))}
        </div>
      )}

      {/* Main chunk */}
      <div className="px-4 py-4 border-l-2 border-accent bg-accent/5">
        <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{s.text}</p>
      </div>

      {/* Context after */}
      {s.context_after.length > 0 && (
        <div className="space-y-0.5 mb-2">
          {s.context_after.map((c) => (
            <ChunkPreview key={c.chunk_index} chunk={c} direction="after" />
          ))}
        </div>
      )}
    </div>
  );
}
