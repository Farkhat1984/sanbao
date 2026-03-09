"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Hook for copying text to clipboard with a temporary "copied" indicator.
 * Handles the common pattern: write to clipboard -> show checkmark -> reset after timeout.
 *
 * @param timeout - Duration in ms to show the "copied" state (default: 2000)
 */
export function useCopyToClipboard(timeout = 2000): {
  copied: boolean;
  copy: (text: string) => Promise<void>;
} {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), timeout);
    },
    [timeout],
  );

  return { copied, copy };
}
