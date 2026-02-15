"use client";

import { useState } from "react";
import { FileText, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";
import { useAgentStore, type AgentToolInfo } from "@/stores/agentStore";
import { ICON_MAP } from "@/components/agents/AgentIconPicker";
import { cn } from "@/lib/utils";
import { TemplateModal } from "./TemplateModal";
import { ImageEditModal } from "@/components/image-edit/ImageEditModal";

interface TemplateField {
  id: string;
  label: string;
  placeholder: string;
  type: "text" | "date" | "number" | "textarea" | "select";
  options?: string[];
  required: boolean;
}

interface ToolTemplate {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  promptTemplate: string;
}

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ToolsPanel({ isOpen, onClose }: ToolsPanelProps) {
  const { setPendingInput } = useChatStore();
  const { agentTools } = useAgentStore();
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<ToolTemplate | null>(null);
  const [imageEditOpen, setImageEditOpen] = useState(false);

  const getTemplates = (tool: AgentToolInfo): ToolTemplate[] => {
    const config = tool.config as { templates?: ToolTemplate[] };
    return Array.isArray(config?.templates) ? config.templates : [];
  };

  const getPrompt = (tool: AgentToolInfo): string => {
    const config = tool.config as { prompt?: string };
    return config?.prompt || "";
  };

  const handleSelectTool = (tool: AgentToolInfo) => {
    if (tool.name === "Редактировать изображение") {
      setImageEditOpen(true);
      onClose();
      return;
    }
    const templates = getTemplates(tool);
    if (templates.length > 0) {
      setExpandedToolId(expandedToolId === tool.id ? null : tool.id);
    } else {
      sendPrompt(getPrompt(tool));
    }
  };

  const sendPrompt = (prompt: string) => {
    if (!prompt) return;
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
                  Инструменты
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
                {agentTools.length === 0 && (
                  <p className="col-span-2 text-xs text-text-muted text-center py-4">
                    Нет доступных инструментов
                  </p>
                )}
                {agentTools.map((tool) => {
                  const templates = getTemplates(tool);
                  const hasTemplates = templates.length > 0;
                  const isExpanded = expandedToolId === tool.id;
                  const ToolIcon = ICON_MAP[tool.icon] || ICON_MAP.Wrench;

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
                            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${tool.iconColor}15` }}
                          >
                            <ToolIcon className="h-4 w-4" style={{ color: tool.iconColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <h4 className="text-xs font-semibold text-text-primary">
                                {tool.name}
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
                                onClick={() => sendPrompt(getPrompt(tool))}
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
