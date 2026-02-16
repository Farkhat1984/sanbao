"use client";

import { useState } from "react";
import {
  X,
  Loader2,
  Download,
  RotateCcw,
  Sparkles,
  ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { openArtifactInPanel } from "@/lib/panel-actions";

interface ImageGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImageGenerateModal({ isOpen, onClose }: ImageGenerateModalProps) {
  const [prompt, setPrompt] = useState("");
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    setError(null);
    setResultImage(null);

    try {
      const res = await fetch("/api/image-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Ошибка" }));
        setError(data.error || "Не удалось сгенерировать изображение");
        return;
      }

      const data = await res.json();
      const img = data.imageBase64 || data.imageUrl;
      if (img) {
        setResultImage(img);
      } else {
        setError("Не удалось получить результат");
      }
    } catch {
      setError("Ошибка подключения");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement("a");
    a.href = resultImage;
    a.download = `generated-${Date.now()}.png`;
    a.click();
  };

  const handleOpenInArtifact = () => {
    if (!resultImage) return;
    openArtifactInPanel({
      id: crypto.randomUUID(),
      type: "IMAGE",
      title: prompt.trim().slice(0, 60) || "Сгенерированное изображение",
      content: resultImage,
      version: 1,
    });
    onClose();
  };

  const handleReset = () => {
    setPrompt("");
    setResultImage(null);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Генерация изображения
                    </h3>
                    <p className="text-[10px] text-text-muted">
                      FLUX-1-schnell — AI генератор
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Result preview */}
                {resultImage && (
                  <div>
                    <p className="text-[10px] font-medium text-text-muted mb-1.5 uppercase tracking-wide">
                      Результат
                    </p>
                    <div className="rounded-xl overflow-hidden border border-accent/30 bg-surface-alt">
                      <img
                        src={resultImage}
                        alt="Generated"
                        className="w-full h-auto max-h-[400px] object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Prompt */}
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1.5">
                    Опишите изображение
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Например: 'Горный пейзаж на закате с озером', 'Логотип юридической компании в минималистичном стиле'..."
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                    rows={3}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <div className="flex items-center gap-2">
                  {resultImage && (
                    <>
                      <button
                        onClick={handleDownload}
                        className="h-8 px-3 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt border border-border flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Скачать
                      </button>
                      <button
                        onClick={handleOpenInArtifact}
                        className="h-8 px-3 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt border border-border flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        Открыть в панели
                      </button>
                      <button
                        onClick={handleReset}
                        className="h-8 px-3 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface-alt flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Сначала
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!prompt.trim() || isProcessing}
                  className="h-8 px-4 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Генерация...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      {resultImage ? "Сгенерировать ещё" : "Сгенерировать"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
