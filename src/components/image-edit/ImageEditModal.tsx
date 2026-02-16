"use client";

import { useState, useRef, useCallback } from "react";
import {
  X,
  Upload,
  ImageIcon,
  Loader2,
  Download,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { openArtifactInPanel } from "@/lib/panel-actions";
import { MAX_FILE_SIZE_PARSE } from "@/lib/constants";

interface ImageEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImageEditModal({ isOpen, onClose }: ImageEditModalProps) {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Поддерживаются только изображения (PNG, JPG, WEBP)");
      return;
    }
    if (file.size > MAX_FILE_SIZE_PARSE) {
      setError("Максимальный размер файла — 20 МБ");
      return;
    }
    setError(null);
    setSourceFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSourceImage(e.target?.result as string);
      setResultImage(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSubmit = async () => {
    if (!sourceImage || !prompt.trim()) return;
    setIsProcessing(true);
    setError(null);
    setResultImage(null);

    try {
      const res = await fetch("/api/image-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: sourceImage, prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Ошибка" }));
        setError(data.error || "Не удалось обработать изображение");
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
    a.download = `edited-${sourceFileName || "image"}.png`;
    a.click();
  };

  const handleOpenInArtifact = () => {
    if (!resultImage) return;
    openArtifactInPanel({
      id: crypto.randomUUID(),
      type: "IMAGE",
      title: prompt.trim().slice(0, 60) || "Редактированное изображение",
      content: resultImage,
      version: 1,
    });
    onClose();
  };

  const handleReset = () => {
    setSourceImage(null);
    setSourceFileName("");
    setPrompt("");
    setResultImage(null);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
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
            <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Редактирование изображения
                    </h3>
                    <p className="text-[10px] text-text-muted">
                      Qwen Image Edit — AI редактор
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
                {/* Image upload / preview */}
                {!sourceImage ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all",
                      isDragOver
                        ? "border-accent bg-accent-light"
                        : "border-border hover:border-accent/50 hover:bg-surface-alt"
                    )}
                  >
                    <div className="h-12 w-12 rounded-xl bg-surface-alt flex items-center justify-center">
                      <Upload className="h-6 w-6 text-text-muted" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-text-primary">
                        Перетащите изображение сюда
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        или нажмите для выбора файла (PNG, JPG, WEBP до 20 МБ)
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Images: source and result side by side */}
                    <div className={cn("grid gap-3", resultImage ? "grid-cols-2" : "grid-cols-1")}>
                      <div className="relative">
                        <p className="text-[10px] font-medium text-text-muted mb-1.5 uppercase tracking-wide">
                          Оригинал
                        </p>
                        <div className="rounded-xl overflow-hidden border border-border bg-surface-alt">
                          <img
                            src={sourceImage}
                            alt="Source"
                            className="w-full h-auto max-h-[300px] object-contain"
                          />
                        </div>
                      </div>
                      {resultImage && (
                        <div className="relative">
                          <p className="text-[10px] font-medium text-text-muted mb-1.5 uppercase tracking-wide">
                            Результат
                          </p>
                          <div className="rounded-xl overflow-hidden border border-accent/30 bg-surface-alt">
                            <img
                              src={resultImage}
                              alt="Result"
                              className="w-full h-auto max-h-[300px] object-contain"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Change image button */}
                    <button
                      onClick={() => {
                        setSourceImage(null);
                        setResultImage(null);
                      }}
                      className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ImageIcon className="h-3 w-3" />
                      Заменить изображение
                    </button>
                  </div>
                )}

                {/* Prompt */}
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1.5">
                    Что изменить?
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Опишите что нужно изменить, например: 'Измени цвет фона на синий', 'Удали текст с изображения', 'Добавь солнечные лучи'..."
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
                  disabled={!sourceImage || !prompt.trim() || isProcessing}
                  className="h-8 px-4 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Обработка...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      {resultImage ? "Редактировать ещё" : "Редактировать"}
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
