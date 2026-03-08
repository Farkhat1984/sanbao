"use client";

import { useState, useRef } from "react";
import { UploadSimple, FileText, X, CheckCircle, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MAX_AGENT_FILE_SIZE } from "@/lib/constants";

interface FileUploaderProps {
  orgId: string;
  agentId: string;
  onComplete: () => void;
}

export function FileUploader({ orgId, agentId, onComplete }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndAddFiles = (newFiles: File[]) => {
    const valid: File[] = [];
    for (const file of newFiles) {
      if (file.size > MAX_AGENT_FILE_SIZE) {
        setError(`«${file.name}» превышает лимит 100 МБ`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length > 0) setFiles((prev) => [...prev, ...valid]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    validateAndAddFiles(Array.from(e.dataTransfer.files));
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setUploadedCount(0);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const res = await fetch(`/api/organizations/${orgId}/agents/${agentId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка загрузки");
        return;
      }

      const data = await res.json();
      setUploadedCount(Array.isArray(data) ? data.length : files.length);

      // Auto-proceed after short delay
      setTimeout(onComplete, 1500);
    } catch {
      setError("Ошибка сети");
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  if (uploadedCount > 0) {
    return (
      <div className="text-center py-8">
        <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-success" weight="duotone" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">
          Загружено {uploadedCount} файл(ов)
        </h2>
        <p className="text-sm text-text-secondary">Переходим к обработке...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors",
          "border-border hover:border-accent/50 hover:bg-accent/5"
        )}
      >
        <UploadSimple className="h-8 w-8 text-text-secondary mx-auto mb-3" weight="duotone" />
        <p className="text-sm text-text-primary font-medium">
          Перетащите файлы или нажмите для выбора
        </p>
        <p className="text-xs text-text-secondary mt-1">
          PDF, DOCX, XLSX, HTML, CSV, TXT · до 100 МБ
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.html,.csv,.txt,.doc,.xls"
          onChange={handleSelect}
          className="hidden"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface">
              <FileText className="h-4 w-4 text-text-secondary shrink-0" weight="duotone" />
              <span className="text-sm text-text-primary truncate flex-1">{file.name}</span>
              <span className="text-xs text-text-secondary shrink-0">{formatSize(file.size)}</span>
              <button
                onClick={() => removeFile(i)}
                className="h-6 w-6 rounded flex items-center justify-center text-text-secondary hover:text-error cursor-pointer"
              >
                <X className="h-3.5 w-3.5" weight="duotone" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-error-light text-error text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
        className="w-full h-11 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        {uploading ? "Загрузка..." : `Загрузить ${files.length} файл(ов)`}
      </button>
    </div>
  );
}
