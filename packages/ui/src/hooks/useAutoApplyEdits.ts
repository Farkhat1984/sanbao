"use client";

import { useEffect, useRef } from "react";
import type { ParsedPart } from "@/lib/parse-message-content";

// ─── Types ────────────────────────────────────────────────

interface UseAutoApplyEditsOptions {
  /** Message ID — used to namespace applied-edit keys */
  messageId: string;
  /** Parsed message parts (only edit parts are processed) */
  parts: ParsedPart[];
  /** Whether this message is from the assistant */
  isAssistant: boolean;
  /** Current display content — triggers re-evaluation during streaming */
  displayContent: string;
  /** Artifact store: find artifact by title */
  findByTitle: (title: string) => { id: string } | undefined;
  /** Artifact store: apply edits to an artifact */
  applyEdits: (id: string, edits: NonNullable<ParsedPart["edits"]>) => void;
}

// ─── Hook ─────────────────────────────────────────────────

/**
 * Automatically applies `<sanbao-edit>` patches to existing artifacts.
 * Tracks which edits have been applied (by message+title key) to avoid duplicates.
 */
export function useAutoApplyEdits({
  messageId,
  parts,
  isAssistant,
  displayContent,
  findByTitle,
  applyEdits,
}: UseAutoApplyEditsOptions): void {
  const appliedEditsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAssistant) return;

    const editParts = parts.filter((p) => p.type === "edit");
    for (const part of editParts) {
      const editKey = `${messageId}-${part.title}`;
      if (appliedEditsRef.current.has(editKey)) continue;
      appliedEditsRef.current.add(editKey);

      const target = findByTitle(part.title || "");
      if (target && part.edits) {
        applyEdits(target.id, part.edits);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, displayContent, findByTitle, applyEdits]);
}
