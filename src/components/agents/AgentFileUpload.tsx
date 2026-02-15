"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Loader2, BookOpen, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentFile } from "@/types/agent";
import { MAX_FILE_SIZE } from "@/lib/constants";

interface AgentFileUploadProps {
  agentId: string | null;
  files: AgentFile[];
  onFileAdded: (file: AgentFile) => void;
  onFileRemoved: (fileId: string) => void;
  onFileUpdated?: (file: AgentFile) => void;
}

export function AgentFileUpload({
  agentId,
  files,
  onFileAdded,
  onFileRemoved,
  onFileUpdated,
}: AgentFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!agentId) {
        setError("Сначала сохраните агента, затем загрузите файлы");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("Файл слишком большой (макс. 10MB)");
        return;
      }

      setError(null);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/agents/${agentId}/files`, {
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
    [agentId, onFileAdded]
  );

  const handleDelete = async (fileId: string) => {
    if (!agentId) return;

    try {
      const res = await fetch(`/api/agents/${agentId}/files`, {
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
    if (!agentId) return;
    try {
      const res = await fetch(`/api/agents/${agentId}/files`, {
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
          <Upload className="h-8 w-8 text-text-muted mx-auto mb-2" />
        )}
        <p className="text-sm text-text-muted">
          {uploading
            ? "Загрузка..."
            : "Перетащите файл или нажмите для выбора"}
        </p>
        <p className="text-xs text-text-muted mt-1">
          PDF, DOCX, XLSX, TXT, MD, изображения до 10MB
        </p>
      </div>

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
                <FileText className="h-4 w-4 text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {file.fileName}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatSize(file.fileSize)}
                    {!isInContext && " · по запросу"}
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
                      ? "text-accent hover:text-text-muted hover:bg-surface-hover"
                      : "text-text-muted hover:text-accent hover:bg-accent/10"
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
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
