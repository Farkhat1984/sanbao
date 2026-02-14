"use client";

import { useState, useCallback } from "react";
import { Send, X } from "lucide-react";
import { motion } from "framer-motion";
import { Modal } from "@/components/ui/Modal";
import { useChatStore } from "@/stores/chatStore";
import type { ClarifyQuestion } from "@/stores/chatStore";
import { cn } from "@/lib/utils";

export function ClarifyModal() {
  const { clarifyQuestions, setClarifyQuestions, setPendingInput } =
    useChatStore();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleClose = useCallback(() => {
    setClarifyQuestions(null);
    setAnswers({});
  }, [setClarifyQuestions]);

  const toggleOption = useCallback(
    (questionId: string, option: string) => {
      setAnswers((prev) => {
        const current = prev[questionId] || "";
        const selected = current
          .split(", ")
          .filter(Boolean);

        if (selected.includes(option)) {
          return {
            ...prev,
            [questionId]: selected
              .filter((s) => s !== option)
              .join(", "),
          };
        }
        return {
          ...prev,
          [questionId]: [...selected, option].join(", "),
        };
      });
    },
    []
  );

  const setTextAnswer = useCallback(
    (questionId: string, value: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (!clarifyQuestions) return;

    const lines = clarifyQuestions
      .map((q: ClarifyQuestion) => {
        const answer = answers[q.id]?.trim();
        if (!answer) return null;
        return `${q.question}\n→ ${answer}`;
      })
      .filter(Boolean);

    if (lines.length === 0) {
      handleClose();
      return;
    }

    const text = `Мои ответы на уточняющие вопросы:\n\n${lines.join("\n\n")}`;
    setClarifyQuestions(null);
    setAnswers({});
    setPendingInput(text);
  }, [clarifyQuestions, answers, setClarifyQuestions, setPendingInput, handleClose]);

  const hasAnyAnswer = Object.values(answers).some((v) => v.trim());

  return (
    <Modal
      isOpen={!!clarifyQuestions && clarifyQuestions.length > 0}
      onClose={handleClose}
      title="Уточняющие вопросы"
      className="max-w-md mx-4"
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {clarifyQuestions?.map((q: ClarifyQuestion, idx: number) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
              delay: idx * 0.07,
            }}
          >
            <p className="text-sm font-medium text-text-primary mb-2">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-accent/10 text-accent text-xs font-semibold mr-1.5">
                {idx + 1}
              </span>
              {q.question}
            </p>

            {q.type === "text" ? (
              <textarea
                value={answers[q.id] || ""}
                onChange={(e) => setTextAnswer(q.id, e.target.value)}
                placeholder={q.placeholder || "Введите ответ..."}
                rows={2}
                className="w-full rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {q.options?.map((option) => {
                  const selected = (answers[q.id] || "")
                    .split(", ")
                    .includes(option);
                  return (
                    <button
                      key={option}
                      onClick={() => toggleOption(q.id, option)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border",
                        selected
                          ? "bg-accent text-white border-accent"
                          : "bg-surface-alt text-text-primary border-border hover:border-accent/50"
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border">
        <button
          onClick={handleClose}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
          Пропустить
        </button>
        <button
          onClick={handleSubmit}
          disabled={!hasAnyAnswer}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer",
            hasAnyAnswer
              ? "bg-accent text-white hover:bg-accent/90"
              : "bg-surface-alt text-text-muted"
          )}
        >
          <Send className="h-3.5 w-3.5" />
          Отправить ответы
        </button>
      </div>
    </Modal>
  );
}
