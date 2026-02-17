"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Compass } from "lucide-react";
import { getRandomFact } from "@/lib/sanbao-facts";

const AUTO_DISMISS_MS = 10_000;
const MIN_MESSAGES_BETWEEN_FACTS = 3;
const SESSION_KEY = "sanbao-facts-shown";

interface SanbaoFactProps {
  isVisible: boolean;
  messageCount: number;
}

export function SanbaoFact({ isVisible, messageCount }: SanbaoFactProps) {
  const [fact, setFact] = useState<{ title: string; text: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const lastShownAtMsg = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getShownIndices = useCallback((): Set<number> => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? new Set(JSON.parse(stored) as number[]) : new Set();
    } catch {
      return new Set();
    }
  }, []);

  const addShownIndex = useCallback((index: number) => {
    try {
      const shown = getShownIndices();
      shown.add(index);
      // Reset if all shown
      if (shown.size >= 25) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify([index]));
      } else {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify([...shown]));
      }
    } catch { /* sessionStorage unavailable */ }
  }, [getShownIndices]);

  useEffect(() => {
    if (!isVisible) {
      setFact(null);
      setDismissed(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (dismissed) return;
    if (messageCount - lastShownAtMsg.current < MIN_MESSAGES_BETWEEN_FACTS) return;

    const shown = getShownIndices();
    const result = getRandomFact(shown);
    if (!result) return;

    setFact(result.fact);
    addShownIndex(result.index);
    lastShownAtMsg.current = messageCount;

    timerRef.current = setTimeout(() => {
      setDismissed(true);
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isVisible, messageCount, dismissed, getShownIndices, addShownIndex]);

  const handleDismiss = () => {
    setDismissed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <AnimatePresence>
      {fact && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-24 right-4 z-40 max-w-xs md:max-w-sm"
        >
          <div className="bg-[var(--bg-secondary)]/95 backdrop-blur-sm border border-[var(--border)] rounded-2xl p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <Compass className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">
                  {fact.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {fact.text}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 p-1 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-muted)] italic">
                Чжэн Хэ (Ma Sanbao) — великий мореплаватель XV века
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
