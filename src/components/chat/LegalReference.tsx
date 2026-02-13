"use client";

import { useState } from "react";
import { BookOpen, ExternalLink, CheckCircle, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LegalRef } from "@/types/chat";

interface LegalReferenceProps {
  reference: LegalRef;
}

export function LegalReference({ reference }: LegalReferenceProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      {/* Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
          "bg-legal-ref-bg text-legal-ref border border-legal-ref/20",
          "hover:bg-legal-ref/10 transition-colors cursor-pointer",
          isOpen && "ring-2 ring-legal-ref/30"
        )}
      >
        <BookOpen className="h-3 w-3" />
        <span>{reference.articleTitle}</span>
        {reference.isActual ? (
          <CheckCircle className="h-3 w-3 text-success" />
        ) : (
          <AlertTriangle className="h-3 w-3 text-warning" />
        )}
      </button>

      {/* Popup */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full mt-2 z-40 w-96 max-h-80 overflow-y-auto bg-surface border border-border rounded-2xl shadow-xl"
            >
              {/* Header */}
              <div className="sticky top-0 bg-surface border-b border-border px-4 py-3 rounded-t-2xl">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">
                      {reference.articleTitle}
                    </h4>
                    <code className="text-[10px] text-text-muted font-mono">
                      {reference.articleCode}
                    </code>
                  </div>
                  <div className="flex items-center gap-1">
                    {reference.isActual ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-success bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-md">
                        <CheckCircle className="h-3 w-3" />
                        Актуальна
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-warning bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                        <AlertTriangle className="h-3 w-3" />
                        Не актуальна
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-3">
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                  {reference.articleText}
                </p>
              </div>

              {/* Footer */}
              {reference.sourceUrl && (
                <div className="border-t border-border px-4 py-2">
                  <a
                    href={reference.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Открыть источник
                  </a>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
