"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Artifact store: apply edits to an artifact. Returns new version number or false. */
  applyEdits: (id: string, edits: NonNullable<ParsedPart["edits"]>) => number | false;
}

// ─── Hook ─────────────────────────────────────────────────

/**
 * Automatically applies `<sanbao-edit>` patches to existing artifacts.
 * Tracks which edits have been applied (by message+title key) to avoid duplicates.
 * Returns a map of title → applied version number for accurate display in edit cards.
 */
export function useAutoApplyEdits({
  messageId,
  parts,
  isAssistant,
  displayContent,
  findByTitle,
  applyEdits,
}: UseAutoApplyEditsOptions): Map<string, number> {
  const appliedEditsRef = useRef<Set<string>>(new Set());
  const [appliedVersions, setAppliedVersions] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    if (!isAssistant) return;

    const editParts = parts.filter((p) => p.type === "edit");
    for (const part of editParts) {
      const editKey = `${messageId}-${part.title}`;
      if (appliedEditsRef.current.has(editKey)) continue;
      appliedEditsRef.current.add(editKey);

      const target = findByTitle(part.title || "");
      if (target && part.edits) {
        const newVersion = applyEdits(target.id, part.edits);
        if (newVersion !== false && part.title) {
          setAppliedVersions((prev) => {
            const next = new Map(prev);
            next.set(part.title!, newVersion);
            return next;
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, displayContent, findByTitle, applyEdits]);

  return appliedVersions;
}
