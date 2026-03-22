"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────

interface UseMessageCollapseOptions {
  /** Whether this message role should be tracked for collapse */
  enabled: boolean;
  /** Whether to skip overflow detection (e.g. during streaming) */
  skipDetection?: boolean;
  /** Height threshold (px) above which message is collapsed */
  collapseHeight: number;
  /** Content string — used as dependency for re-measuring */
  content: string;
  /** Optional delay (ms) before measuring. Useful for CSS transitions. */
  measureDelay?: number;
}

interface UseMessageCollapseReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  isOverflowing: boolean;
}

// ─── Hook ─────────────────────────────────────────────────

/**
 * Manages the expand/collapse state for a message bubble.
 * Measures the element's scrollHeight and compares against the threshold.
 */
export function useMessageCollapse({
  enabled,
  skipDetection = false,
  collapseHeight,
  content,
  measureDelay = 0,
}: UseMessageCollapseOptions): UseMessageCollapseReturn {
  const ref = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (!enabled || isExpanded || skipDetection) return;

    const el = ref.current;
    if (!el) return;

    const measure = () => {
      requestAnimationFrame(() => {
        if (el) setIsOverflowing(el.scrollHeight > collapseHeight);
      });
    };

    if (measureDelay > 0) {
      const timer = setTimeout(measure, measureDelay);
      return () => clearTimeout(timer);
    }

    measure();
    return undefined;
  }, [content, enabled, isExpanded, skipDetection, collapseHeight, measureDelay]);

  return { ref, isExpanded, setIsExpanded, isOverflowing };
}
