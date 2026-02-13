"use client";

import { Scale } from "lucide-react";
import { motion } from "framer-motion";

interface ThinkingIndicatorProps {
  isToolWorking: boolean;
  toolName?: string | null;
}

const TOOL_LABELS: Record<string, string> = {
  createContract: "Создаёт договор",
  createClaim: "Готовит исковое заявление",
  createComplaint: "Составляет жалобу",
  analyzeNpa: "Анализирует НПА",
  checkActuality: "Проверяет актуальность",
  searchArticles: "Ищет статьи закона",
};

export function ThinkingIndicator({ isToolWorking, toolName }: ThinkingIndicatorProps) {
  const label = isToolWorking && toolName
    ? TOOL_LABELS[toolName] || `Использует ${toolName}`
    : "Leema думает";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 py-3"
    >
      {/* Animated scales icon */}
      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-accent to-legal-ref flex items-center justify-center">
        <motion.div
          animate={{
            rotateZ: [0, -8, 8, -4, 4, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Scale className="h-4 w-4 text-white" />
        </motion.div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">{label}</span>
        <motion.div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1 h-1 rounded-full bg-accent"
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
