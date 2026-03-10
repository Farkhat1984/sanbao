"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Loader2, BookOpen, Archive, CheckCircle2, ImageIcon, AlertCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentFile } from "@/types/agent";
import { MAX_FILE_SIZE } from "@/lib/constants";

interface AgentFileUploadProps {
  agentId: string | null;
  files: AgentFile[];
  onFileAdded: (file: AgentFile) => void;
  onFileRemoved: (fileId: string) => void;
  onFileUpdated?: (file: AgentFile) => void;
  onQueuedFilesChange?: (files: File[]) => void;
  /** Override the default upload URL (e.g. for multi-agent files) */
  uploadUrl?: string;
  /** Whether the feature is disabled (e.g. subscription gating) */
  disabled?: boolean;
  /** Message shown when disabled */
  disabledMessage?: string;
}

export function AgentFileUpload({
  agentId,
  files,
  onFileAdded,
  onFileRemoved,
  onFileUpdated,
  onQueuedFilesChange,
  uploadUrl,
  disabled,
  disabledMessage,
}: AgentFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const baseUrl = uploadUrl || (agentId ? `/api/agents/${agentId}/files` : null);

  const queueFile = useCallback(
    (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        setError("Файл слишком большой (макс. 100MB)");
        return;
      }
      setError(null);
      setQueuedFiles((prev) => {
        const next = [...prev, file];
        onQueuedFilesChange?.(next);
        return next;
      });
    },
    [onQueuedFilesChange]
  );

  const removeQueuedFile = (index: number) => {
    setQueuedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onQueuedFilesChange?.(next);
      return next;
    });
  };

  const uploadFile = useCallback(
    async (file: File) => {
      if (!baseUrl) {
        queueFile(file);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("Файл слишком большой (макс. 100MB)");
        return;
      }

      setError(null);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(baseUrl, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Ошибка загрузки");
        }

        const agentFile = await res.json();
        onFileAdded(agentFile);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setUploading(false);
      }
    },
    [baseUrl, onFileAdded, queueFile]
  );

  const handleDelete = async (fileId: string) => {
    if (!baseUrl) return;

    try {
      const res = await fetch(baseUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });

      if (res.ok) {
        onFileRemoved(fileId);
      }
    } catch {
      // Ignore delete errors
    }
  };

  const handleToggleContext = async (fileId: string, currentInContext: boolean) => {
    if (!baseUrl) return;
    try {
      const res = await fetch(baseUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, inContext: !currentInContext }),
      });
      if (res.ok) {
        const updated = await res.json();
        onFileUpdated?.(updated);
      }
    } catch {
      // silent
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (disabled) {
    return (
      <div className="relative rounded-xl border-2 border-dashed border-border p-6 text-center opacity-60">
        <Lock className="h-8 w-8 text-text-muted mx-auto mb-2" />
        <p className="text-sm text-text-secondary">
          {disabledMessage || "Файлы знаний доступны на тарифе Business"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
          isDragging
            ? "border-accent bg-accent-light"
            : "border-border hover:border-border-hover hover:bg-surface-alt",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handleChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.webp"
        />
        {uploading ? (
          <Loader2 className="h-8 w-8 text-accent mx-auto mb-2 animate-spin" />
        ) : (
          <Upload className="h-8 w-8 text-text-secondary mx-auto mb-2" />
        )}
        <p className="text-sm text-text-secondary">
          {uploading
            ? "Загрузка..."
            : "Перетащите файл или нажмите для выбора"}
        </p>
        <p className="text-xs text-text-secondary mt-1">
          PDF, DOCX, XLSX, TXT, MD, изображения до 100MB
        </p>
      </div>
      {baseUrl && (
        <p className="text-xs text-text-muted">
          Текст из файлов автоматически извлекается и используется агентом в чате как база знаний
        </p>
      )}

      {error && (
        <p className="text-xs text-error">{error}</p>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => {
            const isInContext = file.inContext !== false;
            return (
              <div
                key={file.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl bg-surface-alt border border-border",
                  !isInContext && "opacity-60"
                )}
              >
                <FileText className="h-4 w-4 text-text-secondary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {file.fileName}
                  </p>
                  <p className="text-xs text-text-secondary flex items-center gap-1.5">
                    {formatSize(file.fileSize)}
                    {!isInContext && " · по запросу"}
                    {file.fileType?.startsWith("image/") ? (
                      <span className="inline-flex items-center gap-0.5 text-text-muted">
                        · <ImageIcon className="h-3 w-3" /> изображение
                      </span>
                    ) : file.extractedText ? (
                      <span className="inline-flex items-center gap-0.5 text-success">
                        · <CheckCircle2 className="h-3 w-3" /> текст извлечён
                      </span>
                    ) : file.extractedText === null && file.id ? (
                      <span className="inline-flex items-center gap-0.5 text-warning">
                        · <AlertCircle className="h-3 w-3" /> текст не извлечён
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleContext(file.id, isInContext);
                  }}
                  title={isInContext ? "В контексте — нажмите чтобы перевести в режим 'по запросу'" : "По запросу — нажмите чтобы включить в контекст"}
                  className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
                    isInContext
                      ? "text-accent hover:text-text-secondary hover:bg-surface-hover"
                      : "text-text-secondary hover:text-accent hover:bg-accent/10"
                  )}
                >
                  {isInContext ? <BookOpen className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(file.id);
                  }}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Queued files (pending upload after agent creation) */}
      {queuedFiles.length > 0 && (
        <div className="space-y-2">
          {queuedFiles.map((file, i) => (
            <div
              key={`queued-${i}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20"
            >
              <FileText className="h-4 w-4 text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{file.name}</p>
                <p className="text-xs text-warning">
                  {formatSize(file.size)} · загрузится после создания
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeQueuedFile(i)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
