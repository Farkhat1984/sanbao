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
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";
import { getTemplatesForTool } from "@/lib/legal-templates";
import { TemplateModal } from "./TemplateModal";
import { ImageEditModal } from "@/components/image-edit/ImageEditModal";
import type { LegalTemplate } from "@/lib/legal-templates";

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
      "Я хочу создать договор по законодательству РК. Пожалуйста, уточни: 1) Тип договора (купли-продажи, оказания услуг, аренды и т.д.), 2) Стороны договора (наименование, БИН/ИИН), 3) Основные условия и сумму в тенге.",
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950",
  },
  {
    id: "claim",
    icon: Gavel,
    title: "Подготовить иск",
    description: "Исковое заявление в суд РК",
    prompt:
      "Я хочу подготовить исковое заявление по законодательству РК. Пожалуйста, уточни: 1) Тип иска, 2) Суть спора, 3) Требования к ответчику, 4) В какой суд подаётся.",
    color: "text-purple-500 bg-purple-50 dark:bg-purple-950",
  },
  {
    id: "complaint",
    icon: AlertTriangle,
    title: "Составить жалобу",
    description: "Жалоба в гос. органы РК или суд",
    prompt:
      "Я хочу составить жалобу по законодательству РК. Пожалуйста, уточни: 1) На что жалоба, 2) В какой орган направляется (прокуратура, акимат, суд и т.д.), 3) Суть нарушения.",
    color: "text-amber-500 bg-amber-50 dark:bg-amber-950",
  },
  {
    id: "search",
    icon: Search,
    title: "Поиск по НПА РК",
    description: "Найти статью закона или нормативный акт РК",
    prompt:
      "Помоги найти нормативно-правовой акт Республики Казахстан. Что именно ищешь? Укажи тему, ключевые слова или номер закона.",
    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950",
  },
  {
    id: "check",
    icon: CheckCircle,
    title: "Проверить актуальность",
    description: "Проверка актуальности статьи закона РК",
    prompt:
      "Проверь актуальность следующей статьи закона РК. Укажи номер статьи и закона, и я проверю последние изменения и поправки.",
    color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950",
  },
  {
    id: "consult",
    icon: MessageSquare,
    title: "Консультация",
    description: "Юридическая консультация по законодательству РК",
    prompt:
      "Мне нужна юридическая консультация по законодательству Казахстана. Опиши свою ситуацию, и я помогу разобраться с правовой стороной.",
    color: "text-rose-500 bg-rose-50 dark:bg-rose-950",
  },
  {
    id: "image-edit",
    icon: Sparkles,
    title: "Редактировать изображение",
    description: "Изменить изображение с помощью AI",
    prompt: "",
    color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950",
  },
];

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ToolsPanel({ isOpen, onClose }: ToolsPanelProps) {
  const { setPendingInput } = useChatStore();
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<LegalTemplate | null>(
    null
  );
  const [imageEditOpen, setImageEditOpen] = useState(false);

  const handleSelectTool = (tool: Tool) => {
    if (tool.id === "image-edit") {
      setImageEditOpen(true);
      onClose();
      return;
    }
    const templates = getTemplatesForTool(tool.id);
    if (templates.length > 0) {
      setExpandedToolId(expandedToolId === tool.id ? null : tool.id);
    } else {
      sendPrompt(tool.prompt);
    }
  };

  const sendPrompt = (prompt: string) => {
    setPendingInput(prompt);
    onClose();
    setExpandedToolId(null);
  };

  const handleTemplateSubmit = (filledPrompt: string) => {
    setPendingInput(filledPrompt);
    setActiveTemplate(null);
    onClose();
    setExpandedToolId(null);
  };

  return (
    <>
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
                {tools.map((tool) => {
                  const templates = getTemplatesForTool(tool.id);
                  const hasTemplates = templates.length > 0;
                  const isExpanded = expandedToolId === tool.id;

                  return (
                    <div
                      key={tool.id}
                      className={cn(
                        "rounded-xl border border-border transition-all",
                        isExpanded
                          ? "col-span-2 border-accent/30 bg-surface-alt/50"
                          : "hover:border-border-hover hover:bg-surface-alt"
                      )}
                    >
                      <button
                        onClick={() => handleSelectTool(tool)}
                        className="w-full text-left p-3 cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                              tool.color
                            )}
                          >
                            <tool.icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <h4 className="text-xs font-semibold text-text-primary">
                                {tool.title}
                              </h4>
                              {hasTemplates && (
                                <ChevronRight
                                  className={cn(
                                    "h-3 w-3 text-text-muted transition-transform",
                                    isExpanded && "rotate-90"
                                  )}
                                />
                              )}
                            </div>
                            <p className="text-[10px] text-text-muted leading-snug">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      </button>

                      {/* Template submenu */}
                      <AnimatePresence>
                        {isExpanded && hasTemplates && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-1">
                              {templates.map((tmpl) => (
                                <button
                                  key={tmpl.id}
                                  onClick={() => setActiveTemplate(tmpl)}
                                  className="w-full text-left px-3 py-2 rounded-lg text-[11px] text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer flex items-center gap-2 border border-transparent hover:border-border"
                                >
                                  <FileText className="h-3 w-3 text-accent shrink-0" />
                                  <div className="min-w-0">
                                    <span className="font-medium">
                                      {tmpl.name}
                                    </span>
                                    <p className="text-[10px] text-text-muted truncate">
                                      {tmpl.description}
                                    </p>
                                  </div>
                                </button>
                              ))}
                              <button
                                onClick={() => sendPrompt(tool.prompt)}
                                className="w-full text-left px-3 py-2 rounded-lg text-[11px] text-text-muted hover:text-text-secondary hover:bg-surface-alt transition-colors cursor-pointer"
                              >
                                Без шаблона — свободная форма
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Template modal */}
      <TemplateModal
        template={activeTemplate}
        isOpen={!!activeTemplate}
        onClose={() => setActiveTemplate(null)}
        onSubmit={handleTemplateSubmit}
      />

      {/* Image edit modal */}
      <ImageEditModal
        isOpen={imageEditOpen}
        onClose={() => setImageEditOpen(false)}
      />
    </>
  );
}
