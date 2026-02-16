"use client";

import {
  Brain,
  MessageSquare,
  Globe,
  ListChecks,
  Database,
  Calculator,
  Bookmark,
  ClipboardList,
  Bell,
  StickyNote,
  BarChart3,
  Send,
  Plug,
} from "lucide-react";
import { motion } from "framer-motion";
import type { StreamingPhase } from "@/stores/chatStore";
import { getToolCategory, type ToolCategory } from "@/stores/chatStore";

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
    gradient: "from-emerald-500 to-teal-600",
    dot: "bg-emerald-500",
  },
  knowledge: {
    Icon: Database,
    label: "Ищет в базе знаний",
    gradient: "from-indigo-500 to-blue-600",
    dot: "bg-indigo-500",
  },
  calculation: {
    Icon: Calculator,
    label: "Вычисляет",
    gradient: "from-sky-500 to-blue-600",
    dot: "bg-sky-500",
  },
  memory: {
    Icon: Bookmark,
    label: "Сохраняет в память",
    gradient: "from-pink-500 to-rose-600",
    dot: "bg-pink-500",
  },
  task: {
    Icon: ClipboardList,
    label: "Создаёт задачу",
    gradient: "from-amber-500 to-orange-500",
    dot: "bg-amber-500",
  },
  notification: {
    Icon: Bell,
    label: "Отправляет уведомление",
    gradient: "from-yellow-500 to-amber-500",
    dot: "bg-yellow-500",
  },
  scratchpad: {
    Icon: StickyNote,
    label: "Работает с заметками",
    gradient: "from-lime-500 to-green-600",
    dot: "bg-lime-500",
  },
  chart: {
    Icon: BarChart3,
    label: "Строит график",
    gradient: "from-cyan-500 to-teal-600",
    dot: "bg-cyan-500",
  },
  http: {
    Icon: Send,
    label: "Выполняет запрос",
    gradient: "from-orange-500 to-red-500",
    dot: "bg-orange-500",
  },
  mcp: {
    Icon: Plug,
    label: "Использует плагин",
    gradient: "from-purple-500 to-fuchsia-600",
    dot: "bg-purple-500",
  },
  generic: {
    Icon: MessageSquare,
    label: "Использует инструменты",
    gradient: "from-blue-500 to-cyan-600",
    dot: "bg-blue-500",
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
    animate: { y: [0, -3, 0], scale: [1, 1.08, 1] },
    duration: 1.6,
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
    gradientClass = "from-violet-500 to-purple-600";
    dotColorClass = "bg-violet-500";
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
      gradientClass = "from-emerald-500 to-teal-600";
      dotColorClass = "bg-emerald-500";
      animKey = "searching";
    }
  } else if (phase === "using_tool") {
    const vis = TOOL_VISUALS[category];
    label = vis.label;
    Icon = vis.Icon;
    gradientClass = vis.gradient;
    dotColorClass = vis.dot;
    animKey = category;
  } else if (phase === "planning") {
    label = `${name} составляет план`;
    Icon = ListChecks;
    gradientClass = "from-amber-500 to-orange-500";
    dotColorClass = "bg-amber-500";
    animKey = "planning";
  } else {
    label = `${name} отвечает`;
    Icon = MessageSquare;
    gradientClass = "from-accent to-legal-ref";
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
