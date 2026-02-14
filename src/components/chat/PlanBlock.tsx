"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ListChecks, ChevronDown, Loader2, Play, MessageSquare, Send, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";

// ─── Step parsing ────────────────────────────────────────

interface PlanStep {
  id: number;
  text: string;
}

function parseSteps(content: string): PlanStep[] {
  const steps: PlanStep[] = [];
  for (const line of content.split("\n")) {
    // Match "1. Step" or "1) Step" or "- Step" under numbered context
    const m = line.match(/^\s*(?:\d+[\.\)]|-)\s+(.+)/);
    if (m) {
      const text = m[1].replace(/\*\*/g, "").replace(/^[-–—]\s*/, "").trim();
      if (text) steps.push({ id: steps.length, text });
    }
  }
  return steps;
}

// ─── Component ───────────────────────────────────────────

interface PlanBlockProps {
  content: string;
  isStreaming?: boolean;
}

export function PlanBlock({ content, isStreaming }: PlanBlockProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [phase, setPhase] = useState<"selecting" | "sent" | "refining">("selecting");
  const [round, setRound] = useState(1);
  const feedbackRef = useRef<HTMLInputElement>(null);
  const { setPendingInput } = useChatStore();

  const steps = useMemo(() => parseSteps(content), [content]);

  // Reset checked state when steps change during streaming
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (steps.length !== prevCountRef.current) {
      prevCountRef.current = steps.length;
      setCheckedIds(new Set());
    }
  }, [steps.length]);

  // Focus feedback input when shown
  useEffect(() => {
    if (showFeedback) feedbackRef.current?.focus();
  }, [showFeedback]);

  const toggleStep = useCallback((id: number) => {
    if (phase !== "selecting") return;
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [phase]);

  const handleExecute = useCallback(() => {
    const selected = steps.filter((s) => checkedIds.has(s.id));
    const deselected = steps.filter((s) => !checkedIds.has(s.id));

    let text = "";
    if (selected.length === 0 || selected.length === steps.length) {
      text = "Выполни весь план полностью.";
    } else {
      text = `Выполни из плана только:\n${selected.map((s, i) => `${i + 1}. ${s.text}`).join("\n")}`;
      if (deselected.length > 0) {
        text += `\n\nПропусти: ${deselected.map((s) => s.text).join(", ")}`;
      }
    }

    if (feedback.trim()) {
      text += `\n\nДополнительно: ${feedback.trim()}`;
    }

    setPhase("sent");
    setPendingInput(text);
  }, [steps, checkedIds, feedback, setPendingInput]);

  // Send a clarifying question → AI responds with updated plan → new round
  const handleSendFeedback = useCallback(() => {
    if (!feedback.trim()) return;

    const prefix = round === 1
      ? "По поводу плана"
      : `Уточнение (раунд ${round})`;

    setPendingInput(`${prefix}: ${feedback.trim()}\n\nПожалуйста, обнови план с учётом моих уточнений и снова выведи его в <leema-plan>.`);
    setFeedback("");
    setShowFeedback(false);
    setPhase("refining");
    setRound((r) => r + 1);
  }, [feedback, round, setPendingInput]);

  // When new content arrives after refining → back to selecting
  useEffect(() => {
    if (phase === "refining" && !isStreaming && steps.length > 0) {
      setPhase("selecting");
      setCheckedIds(new Set());
    }
  }, [phase, isStreaming, steps.length]);

  const handleReset = useCallback(() => {
    setCheckedIds(new Set());
    setPhase("selecting");
    setFeedback("");
    setShowFeedback(false);
  }, []);

  const hasSteps = steps.length > 0;
  const checkedCount = checkedIds.size;
  const isActive = phase === "selecting";

  return (
    <div className="mb-2 w-full">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[11px] text-amber-500 hover:text-amber-600 transition-colors cursor-pointer mb-1"
      >
        <ListChecks className="h-3 w-3" />
        <span>План</span>
        {round > 1 && (
          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 px-1.5 rounded-full">
            раунд {round}
          </span>
        )}
        {isStreaming && <Loader2 className="h-3 w-3 animate-spin" />}
        {hasSteps && !isStreaming && (
          <span className="text-[10px] text-amber-400">
            {checkedCount}/{steps.length}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs leading-relaxed overflow-hidden"
          >
            {/* Steps list */}
            {hasSteps ? (
              <div className="space-y-1">
                {steps.map((step) => {
                  const isChecked = checkedIds.has(step.id);
                  return (
                    <button
                      key={step.id}
                      onClick={() => toggleStep(step.id)}
                      disabled={!isActive || isStreaming}
                      className={cn(
                        "flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-lg transition-all",
                        isActive && !isStreaming && "hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer",
                        isChecked && "bg-amber-100 dark:bg-amber-900/40",
                        (!isActive || isStreaming) && "opacity-70 cursor-default"
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                        isChecked
                          ? "bg-amber-500 border-amber-500"
                          : "border-amber-300 dark:border-amber-600"
                      )}>
                        {isChecked && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={cn(
                        "text-amber-700 dark:text-amber-300",
                        isChecked && "font-medium"
                      )}>
                        {step.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                {content}
              </div>
            )}

            {/* Action buttons */}
            {hasSteps && !isStreaming && isActive && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-amber-200 dark:border-amber-800">
                <button
                  onClick={handleExecute}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer"
                >
                  <Play className="h-3 w-3" />
                  {checkedCount > 0 && checkedCount < steps.length
                    ? `Выполнить (${checkedCount})`
                    : "Выполнить всё"}
                </button>
                <button
                  onClick={() => setShowFeedback(!showFeedback)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                    showFeedback
                      ? "bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300"
                      : "text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  )}
                >
                  <MessageSquare className="h-3 w-3" />
                  Уточнить
                </button>
                {round > 1 && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-amber-400 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
                    title="Сбросить выбор"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Feedback input */}
            <AnimatePresence>
              {showFeedback && isActive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 overflow-hidden"
                >
                  <div className="flex gap-2">
                    <input
                      ref={feedbackRef}
                      type="text"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendFeedback()}
                      placeholder="Изменить, добавить, убрать..."
                      className="flex-1 rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-amber-950/50 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200 placeholder:text-amber-400 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={handleSendFeedback}
                      disabled={!feedback.trim()}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer",
                        feedback.trim()
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-amber-100 dark:bg-amber-900/30 text-amber-400"
                      )}
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-400 mt-1">
                    AI обновит план с учётом уточнений
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status indicators */}
            {phase === "sent" && (
              <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800 text-[10px] text-amber-500 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Выполняется...
              </div>
            )}
            {phase === "refining" && (
              <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800 text-[10px] text-amber-500 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Обновление плана...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
