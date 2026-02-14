"use client";

import { Scale, Brain, MessageSquare, Globe, ListChecks } from "lucide-react";
import { motion } from "framer-motion";

interface ThinkingIndicatorProps {
  phase: "planning" | "thinking" | "answering" | null;
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

export function ThinkingIndicator({ phase, isToolWorking, toolName }: ThinkingIndicatorProps) {
  const isThinking = phase === "thinking";
  const isSearching = isToolWorking && toolName?.startsWith("Поиск:");

  // Determine display state
  let label: string;
  let Icon: typeof Brain;
  let gradientClass: string;
  let dotColorClass: string;

  if (phase === "planning") {
    label = "Leema составляет план";
    Icon = ListChecks;
    gradientClass = "from-amber-500 to-orange-500";
    dotColorClass = "bg-amber-500";
  } else if (isSearching) {
    label = "Ищет в интернете";
    Icon = Globe;
    gradientClass = "from-emerald-500 to-teal-600";
    dotColorClass = "bg-emerald-500";
  } else if (isToolWorking && toolName) {
    label = TOOL_LABELS[toolName] || toolName;
    Icon = Scale;
    gradientClass = "from-amber-500 to-orange-600";
    dotColorClass = "bg-amber-500";
  } else if (isThinking) {
    label = "Leema думает";
    Icon = Brain;
    gradientClass = "from-violet-500 to-purple-600";
    dotColorClass = "bg-violet-500";
  } else {
    label = "Leema отвечает";
    Icon = MessageSquare;
    gradientClass = "from-accent to-legal-ref";
    dotColorClass = "bg-accent";
  }

  // Different animations per state
  const iconAnimation = isSearching
    ? { rotateY: [0, 360] }
    : isThinking
      ? { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }
      : { rotateZ: [0, -8, 8, -4, 4, 0] };

  const iconDuration = isSearching ? 2 : isThinking ? 1.5 : 2;

  return (
    <motion.div
      key={label}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 py-3"
    >
      {/* Animated icon */}
      <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
        <motion.div
          animate={iconAnimation}
          transition={{
            duration: iconDuration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Icon className="h-4 w-4 text-white" />
        </motion.div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">{label}</span>
        <motion.div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`w-1 h-1 rounded-full ${dotColorClass}`}
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
