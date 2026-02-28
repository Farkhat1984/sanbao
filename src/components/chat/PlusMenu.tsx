"use client";

import {
  Plus,
  Paperclip,
  Wrench,
  Globe,
  Brain,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ToolsPanel } from "@/components/legal-tools/ToolsPanel";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────

export interface PlusMenuProps {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  toolsOpen: boolean;
  setToolsOpen: (open: boolean) => void;
  onAttachClick: () => void;
  onCameraClick: () => void;
  onImageGenOpen: () => void;
  hasAgentTools: boolean;
  webSearchEnabled: boolean;
  thinkingEnabled: boolean;
  toggleWebSearch: () => void;
  toggleThinking: () => void;
}

// ─── Component ──────────────────────────────────────────

export function PlusMenu({
  menuOpen,
  setMenuOpen,
  toolsOpen,
  setToolsOpen,
  onAttachClick,
  onCameraClick,
  onImageGenOpen,
  hasAgentTools,
  webSearchEnabled,
  thinkingEnabled,
  toggleWebSearch,
  toggleThinking,
}: PlusMenuProps) {
  const handleOpenTools = () => {
    setMenuOpen(false);
    setToolsOpen(true);
  };

  const handleAttachClick = () => {
    setMenuOpen(false);
    onAttachClick();
  };

  const handleCameraClick = () => {
    setMenuOpen(false);
    onCameraClick();
  };

  return (
    <div className="relative" data-tour="plus-menu">
      <button
        onClick={() => {
          setMenuOpen(!menuOpen);
          setToolsOpen(false);
        }}
        className={cn(
          "h-8 w-8 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5 cursor-pointer",
          menuOpen
            ? "text-accent bg-accent-light rotate-45"
            : "text-text-muted hover:text-text-primary hover:bg-surface-alt"
        )}
        title="Функции"
      >
        <Plus className="h-4.5 w-4.5 transition-transform" />
      </button>

      {/* Plus menu popover */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
              }}
              className="absolute bottom-full left-0 mb-2 z-40 w-[220px] bg-surface border border-border rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="py-1.5">
                {/* Attach file */}
                <button
                  onClick={handleAttachClick}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                    <Paperclip className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 text-left">
                    <span>Прикрепить файл</span>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      PDF, DOCX, XLSX, PPTX, CSV, HTML, RTF, PNG
                    </p>
                  </div>
                </button>

                {/* Camera */}
                <button
                  onClick={handleCameraClick}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-green-50 text-green-500 flex items-center justify-center">
                    <Camera className="h-3.5 w-3.5" />
                  </div>
                  <span>Сделать фото</span>
                </button>

                {/* Agent tools (shown when agent has PROMPT_TEMPLATE tools) */}
                {hasAgentTools && (
                  <button
                    onClick={handleOpenTools}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                  >
                    <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                      <Wrench className="h-3.5 w-3.5" />
                    </div>
                    <span>Инструменты</span>
                  </button>
                )}

                {/* Image generation */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onImageGenOpen();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                    <ImageIcon className="h-3.5 w-3.5" />
                  </div>
                  <span>Генерация картинок</span>
                </button>

                <div className="h-px bg-border mx-3 my-1" />

                {/* Web Search toggle */}
                <button
                  onClick={() => {
                    toggleWebSearch();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                      webSearchEnabled
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-50 text-emerald-500"
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 text-left">
                    <span>Веб-поиск</span>
                  </div>
                  <div
                    className={cn(
                      "w-8 h-4.5 rounded-full transition-colors relative",
                      webSearchEnabled ? "bg-emerald-500" : "bg-border"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all",
                        webSearchEnabled ? "left-[18px]" : "left-0.5"
                      )}
                    />
                  </div>
                </button>

                {/* Thinking toggle */}
                <button
                  onClick={() => {
                    toggleThinking();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                      thinkingEnabled
                        ? "bg-violet-500 text-white"
                        : "bg-violet-50 text-violet-500"
                    )}
                  >
                    <Brain className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 text-left">
                    <span>Thinking</span>
                  </div>
                  <div
                    className={cn(
                      "w-8 h-4.5 rounded-full transition-colors relative",
                      thinkingEnabled ? "bg-violet-500" : "bg-border"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all",
                        thinkingEnabled ? "left-[18px]" : "left-0.5"
                      )}
                    />
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Legal tools panel (separate popover) */}
      <ToolsPanel
        isOpen={toolsOpen}
        onClose={() => setToolsOpen(false)}
      />
    </div>
  );
}
