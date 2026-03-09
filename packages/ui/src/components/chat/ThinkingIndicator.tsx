"use client";

import {
  Brain,
  MessageSquare,
  Globe,
  ListChecks,
  DatabaseZap,
  Calculator,
  Bookmark,
  ClipboardList,
  Bell,
  StickyNote,
  BarChart3,
  Send,
  Plug,
  Network,
  Users,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import type { StreamingPhase } from "@/stores/chatStore";
import { getToolCategory, type ToolCategory } from "@/lib/chat/tool-categories";

interface ThinkingIndicatorProps {
  phase: StreamingPhase;
  agentName?: string;
  toolName?: string | null;
}

/** Tool category → icon, label, gradient, dot color */
const TOOL_VISUALS: Record<
  ToolCategory,
  {
    Icon: typeof Brain;
    label: string;
    gradient: string;
    dot: string;
  }
> = {
  web_search: {
    Icon: Globe,
    label: "Ищет в интернете",
    gradient: "from-accent to-accent-hover",
    dot: "bg-accent",
  },
  knowledge: {
    Icon: DatabaseZap,
    label: "Ищет в базе знаний",
    gradient: "from-accent to-accent-hover",
    dot: "bg-accent",
  },
  calculation: {
    Icon: Calculator,
    label: "Вычисляет",
    gradient: "from-info to-info",
    dot: "bg-info",
  },
  memory: {
    Icon: Bookmark,
    label: "Сохраняет в память",
    gradient: "from-error to-error",
    dot: "bg-error",
  },
  task: {
    Icon: ClipboardList,
    label: "Создаёт задачу",
    gradient: "from-warning to-warning",
    dot: "bg-warning",
  },
  notification: {
    Icon: Bell,
    label: "Отправляет уведомление",
    gradient: "from-warning to-warning",
    dot: "bg-warning",
  },
  scratchpad: {
    Icon: StickyNote,
    label: "Работает с заметками",
    gradient: "from-success to-success",
    dot: "bg-success",
  },
  chart: {
    Icon: BarChart3,
    label: "Строит график",
    gradient: "from-info to-info",
    dot: "bg-info",
  },
  http: {
    Icon: Send,
    label: "Выполняет запрос",
    gradient: "from-error to-error",
    dot: "bg-error",
  },
  mcp: {
    Icon: Plug,
    label: "Использует плагин",
    gradient: "from-legal-ref to-legal-ref",
    dot: "bg-legal-ref",
  },
  generic: {
    Icon: MessageSquare,
    label: "Использует инструменты",
    gradient: "from-text-secondary to-text-secondary",
    dot: "bg-text-secondary",
  },
};

/** Icon animation variants per phase/category */
const ICON_ANIMATIONS: Record<
  string,
  { animate: Record<string, number[]>; duration: number }
> = {
  thinking: {
    animate: { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] },
    duration: 1.5,
  },
  searching: {
    animate: { rotateY: [0, 360] },
    duration: 2,
  },
  knowledge: {
    animate: { scale: [1, 1.15, 0.95, 1.1, 1], opacity: [0.85, 1, 0.9, 1, 0.85] },
    duration: 1.4,
  },
  calculation: {
    animate: { rotateZ: [0, -10, 10, -5, 5, 0] },
    duration: 1.4,
  },
  memory: {
    animate: { scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] },
    duration: 1.8,
  },
  chart: {
    animate: { scaleY: [0.9, 1.1, 0.95, 1.05, 1] },
    duration: 1.6,
  },
  mcp: {
    animate: { rotate: [0, 90, 180, 270, 360] },
    duration: 2,
  },
  generic: {
    animate: { rotate: [0, 90, 180, 270, 360] },
    duration: 1.8,
  },
  planning: {
    animate: { rotateZ: [0, -8, 8, -4, 4, 0] },
    duration: 2,
  },
  answering: {
    animate: { rotateZ: [0, -8, 8, -4, 4, 0] },
    duration: 2,
  },
  routing: {
    animate: { scale: [1, 1.1, 0.95, 1.05, 1] },
    duration: 1.2,
  },
  consulting: {
    animate: { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] },
    duration: 1.5,
  },
  synthesizing: {
    animate: { rotateZ: [0, -10, 10, -5, 5, 0] },
    duration: 1.6,
  },
};

export function ThinkingIndicator({ phase, agentName, toolName }: ThinkingIndicatorProps) {
  const name = agentName || "Sanbao";
  const category = getToolCategory(toolName ?? null);

  let label: string;
  let Icon: typeof Brain;
  let gradientClass: string;
  let dotColorClass: string;
  let animKey: string;

  if (phase === "thinking") {
    label = `${name} думает`;
    Icon = Brain;
    gradientClass = "from-legal-ref to-[#A07D55]";
    dotColorClass = "bg-legal-ref";
    animKey = "thinking";
  } else if (phase === "searching") {
    // Web search (no tool name) or specific tool
    if (toolName && category !== "web_search") {
      const vis = TOOL_VISUALS[category];
      label = vis.label;
      Icon = vis.Icon;
      gradientClass = vis.gradient;
      dotColorClass = vis.dot;
      animKey = category;
    } else {
      label = "Ищет в интернете";
      Icon = Globe;
      gradientClass = "from-accent to-accent-hover";
      dotColorClass = "bg-accent";
      animKey = "searching";
    }
  } else if (phase === "using_tool") {
    const vis = TOOL_VISUALS[category];
    label = vis.label;
    Icon = vis.Icon;
    gradientClass = vis.gradient;
    dotColorClass = vis.dot;
    animKey = category;
  } else if (phase === "routing") {
    label = "Определяет агентов";
    Icon = Network;
    gradientClass = "from-amber-500 to-amber-600";
    dotColorClass = "bg-amber-500";
    animKey = "routing";
  } else if (phase === "consulting") {
    label = toolName ? `Консультирует: ${toolName}` : "Консультирует агентов";
    Icon = Users;
    gradientClass = "from-accent to-accent-hover";
    dotColorClass = "bg-accent";
    animKey = "consulting";
  } else if (phase === "synthesizing") {
    label = "Формирует решение";
    Icon = Sparkles;
    gradientClass = "from-amber-500 to-amber-600";
    dotColorClass = "bg-amber-500";
    animKey = "synthesizing";
  } else if (phase === "planning") {
    label = `${name} составляет план`;
    Icon = ListChecks;
    gradientClass = "from-warning to-warning";
    dotColorClass = "bg-warning";
    animKey = "planning";
  } else {
    label = `${name} отвечает`;
    Icon = MessageSquare;
    gradientClass = "from-accent to-accent-hover";
    dotColorClass = "bg-accent";
    animKey = "answering";
  }

  const anim = ICON_ANIMATIONS[animKey] || ICON_ANIMATIONS.generic;

  return (
    <motion.div
      key={`${phase}-${animKey}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 py-3"
    >
      {/* Animated icon */}
      <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
        <motion.div
          animate={anim.animate}
          transition={{
            duration: anim.duration,
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
