"use client";

import { useState } from "react";
import {
  FileText,
  Gavel,
  AlertTriangle,
  Search,
  CheckCircle,
  MessageSquare,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";

interface Tool {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  prompt: string;
  color: string;
}

const tools: Tool[] = [
  {
    id: "contract",
    icon: FileText,
    title: "Создать договор",
    description: "Составить договор по шаблону или с нуля",
    prompt:
      "Я хочу создать договор. Пожалуйста, уточни: 1) Тип договора (купли-продажи, оказания услуг, аренды и т.д.), 2) Стороны договора, 3) Основные условия.",
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950",
  },
  {
    id: "claim",
    icon: Gavel,
    title: "Подготовить иск",
    description: "Исковое заявление в суд",
    prompt:
      "Я хочу подготовить исковое заявление. Пожалуйста, уточни: 1) Тип иска, 2) Суть спора, 3) Требования к ответчику.",
    color: "text-purple-500 bg-purple-50 dark:bg-purple-950",
  },
  {
    id: "complaint",
    icon: AlertTriangle,
    title: "Составить жалобу",
    description: "Жалоба в гос. органы или суд",
    prompt:
      "Я хочу составить жалобу. Пожалуйста, уточни: 1) На что жалоба, 2) В какой орган направляется, 3) Суть нарушения.",
    color: "text-amber-500 bg-amber-50 dark:bg-amber-950",
  },
  {
    id: "search",
    icon: Search,
    title: "Поиск по НПА",
    description: "Найти статью закона или нормативный акт",
    prompt:
      "Помоги найти нормативно-правовой акт. Что именно ищешь? Укажи тему, ключевые слова или номер закона.",
    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950",
  },
  {
    id: "check",
    icon: CheckCircle,
    title: "Проверить актуальность",
    description: "Проверка актуальности статьи или закона",
    prompt:
      "Проверь актуальность следующей статьи закона. Укажи номер статьи и закона, и я проверю последние изменения.",
    color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950",
  },
  {
    id: "consult",
    icon: MessageSquare,
    title: "Консультация",
    description: "Юридическая консультация по вопросу",
    prompt:
      "Мне нужна юридическая консультация. Опиши свою ситуацию, и я помогу разобраться с правовой стороной.",
    color: "text-rose-500 bg-rose-50 dark:bg-rose-950",
  },
];

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ToolsPanel({ isOpen, onClose }: ToolsPanelProps) {
  const { addMessage, setStreaming } = useChatStore();

  const handleSelectTool = (tool: Tool) => {
    addMessage({
      id: crypto.randomUUID(),
      role: "ASSISTANT",
      content: tool.prompt,
      createdAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-full left-0 mb-2 z-40 w-[440px] bg-surface border border-border rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">
                Юридические инструменты
              </h3>
              <button
                onClick={onClose}
                className="h-6 w-6 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Tools Grid */}
            <div className="p-3 grid grid-cols-2 gap-2">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleSelectTool(tool)}
                  className="group text-left p-3 rounded-xl border border-border hover:border-border-hover hover:bg-surface-alt transition-all cursor-pointer"
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center mb-2",
                      tool.color
                    )}
                  >
                    <tool.icon className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-semibold text-text-primary mb-0.5">
                    {tool.title}
                  </h4>
                  <p className="text-[10px] text-text-muted leading-snug">
                    {tool.description}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
