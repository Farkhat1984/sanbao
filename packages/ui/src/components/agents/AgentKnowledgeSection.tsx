"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Database,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  FileText,
  X,
  Trash2,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Pipeline stage labels — keys match orchestrator SSE lowercase stage names */
const STAGE_LABELS: Record<string, string> = {
  pre_analyze: "Предварительный анализ...",
  extract: "Извлечение текста...",
  analyze: "Анализ содержимого...",
  tables: "Обнаружение таблиц...",
  chunk: "Разбиение на фрагменты...",
  embed: "Создание эмбеддингов...",
  index: "Индексация...",
  graph: "Построение графа...",
  cluster: "Кластеризация...",
  ready: "Готово!",
};

type KnowledgeStatus = "NONE" | "PROCESSING" | "READY" | "PUBLISHED" | "ERROR";

interface KnowledgeFile {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

interface AgentKnowledgeSectionProps {
  agentId: string;
  knowledgeStatus: KnowledgeStatus;
  knowledgeFiles: KnowledgeFile[];
  disabled?: boolean;
  onRefresh?: () => void;
  errorMessage?: string;
  toolCount?: number;
}

interface ProgressEvent {
  stage?: string;
  progress?: number;
  message?: string;
  status?: string;
}

const MAX_KNOWLEDGE_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_FORMATS = ".pdf,.docx,.xlsx,.txt,.csv,.html,.doc,.xls";

export function AgentKnowledgeSection({
  agentId,
  knowledgeStatus,
  knowledgeFiles,
  disabled = false,
  onRefresh,
  errorMessage,
  toolCount,
}: AgentKnowledgeSectionProps) {
  const [status, setStatus] = useState<KnowledgeStatus>(knowledgeStatus);
  const [files, setFiles] = useState<KnowledgeFile[]>(knowledgeFiles);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stageName, setStageName] = useState("Подготовка...");
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Sync props when parent refreshes
  useEffect(() => {
    setStatus(knowledgeStatus);
    setFiles(knowledgeFiles);
  }, [knowledgeStatus, knowledgeFiles]);

  const persistStatus = useCallback(
    async (newStatus: KnowledgeStatus) => {
      try {
        await fetch(`/api/agents/${agentId}/knowledge/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch {
        // Best-effort
      }
    },
    [agentId]
  );

  /** Auto-publish after processing completes (SSE reports READY) */
  const autoPublish = useCallback(async () => {
    setStageName("Публикация MCP...");
    setProgress(95);
    try {
      const res = await fetch(
        `/api/agents/${agentId}/knowledge/publish`,
        { method: "POST" }
      );
      if (!res.ok) {
        const text = await res.text();
        let msg = "Ошибка публикации";
        try { msg = JSON.parse(text).error || msg; } catch { /* */ }
        throw new Error(msg);
      }
      setProgress(100);
      setStageName("Готово!");
      setStatus("PUBLISHED");
      onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка публикации");
      setStatus("ERROR");
      persistStatus("ERROR");
    }
  }, [agentId, onRefresh, persistStatus]);

  // SSE progress listener when status is PROCESSING
  useEffect(() => {
    if (status !== "PROCESSING") return;

    const es = new EventSource(
      `/api/agents/${agentId}/knowledge/progress`
    );
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        if (data.progress !== undefined) {
          // Reserve 5% for publish step
          setProgress(Math.min(Math.round(data.progress * 0.9), 90));
        }
        if (data.stage) {
          setStageName(STAGE_LABELS[data.stage] || data.stage);
        }
        if (data.message) {
          setStageName(data.message);
        }
        if (data.status === "completed" || data.status === "done") {
          es.close();
          // Auto-publish immediately
          autoPublish();
        }
        if (data.status === "error") {
          setStageName("Ошибка обработки");
          es.close();
          setStatus("ERROR");
          persistStatus("ERROR");
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [status, agentId, persistStatus, autoPublish]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  const addFiles = useCallback((newFiles: File[]) => {
    const valid: File[] = [];
    for (const file of newFiles) {
      if (file.size > MAX_KNOWLEDGE_FILE_SIZE) {
        setError(`Файл "${file.name}" превышает лимит 100 МБ`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length > 0) {
      setStagedFiles((prev) => [...prev, ...valid]);
      setError(null);
    }
  }, []);

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  /** Unified flow: upload → process → (SSE) → auto-publish */
  const handleUploadAndProcess = async () => {
    if (stagedFiles.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    setStageName("Загрузка файлов...");

    try {
      // Step 1: Upload files
      const formData = new FormData();
      stagedFiles.forEach((f) => formData.append("files", f));

      const uploadRes = await fetch(
        `/api/agents/${agentId}/knowledge/upload`,
        { method: "POST", body: formData }
      );

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        let msg = "Ошибка загрузки";
        try { msg = JSON.parse(text).error || msg; } catch { msg = text.slice(0, 200); }
        throw new Error(msg);
      }

      const uploaded = await uploadRes.json();
      if (Array.isArray(uploaded)) {
        setFiles((prev) => [...prev, ...uploaded]);
      }
      setStagedFiles([]);

      // Step 2: Start processing
      setStageName("Запуск обработки...");
      const processRes = await fetch(
        `/api/agents/${agentId}/knowledge/process`,
        { method: "POST" }
      );

      if (!processRes.ok) {
        const text = await processRes.text();
        let msg = "Ошибка запуска обработки";
        try { msg = JSON.parse(text).error || msg; } catch { /* */ }
        throw new Error(msg);
      }

      // Step 3: SSE will handle progress → auto-publish
      setStatus("PROCESSING");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setStatus("ERROR");
      persistStatus("ERROR");
    } finally {
      setBusy(false);
    }
  };

  /** Cancel processing */
  const handleCancel = async () => {
    setCancelling(true);
    try {
      esRef.current?.close();
      await fetch(`/api/agents/${agentId}/knowledge/cancel`, {
        method: "POST",
      });
      setStatus("NONE");
      setProgress(0);
      setStageName("Подготовка...");
      onRefresh?.();
    } catch {
      setError("Не удалось отменить обработку");
    } finally {
      setCancelling(false);
    }
  };

  /** Delete entire knowledge base */
  const handleDelete = async () => {
    setDeleting(true);
    setShowDeleteConfirm(false);
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge/delete`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Ошибка удаления";
        try { msg = JSON.parse(text).error || msg; } catch { /* */ }
        throw new Error(msg);
      }
      setStatus("NONE");
      setFiles([]);
      setProgress(0);
      setError(null);
      onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setStatus("NONE");
    onRefresh?.();
  };

  // -- Disabled state (plan gating) --
  if (disabled) {
    return (
      <div className="relative rounded-xl border-2 border-dashed border-border p-6 text-center opacity-60">
        <Lock className="h-8 w-8 text-text-muted mx-auto mb-2" />
        <p className="text-sm font-medium text-text-secondary">
          База знаний LeemaDB
        </p>
        <p className="text-xs text-text-muted mt-1">
          Доступна на тарифе Business
        </p>
      </div>
    );
  }

  const isWorking = status === "PROCESSING" || busy;

  return (
    <div className="space-y-3">
      {/* Error banner */}
      {(status === "ERROR" || error) && (
        <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-error shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-error">
              {error || errorMessage || "Произошла ошибка при обработке"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="h-7 px-3 rounded-lg bg-error/10 text-error text-xs font-medium hover:bg-error/20 transition-colors cursor-pointer shrink-0"
          >
            Повторить
          </button>
        </div>
      )}

      {/* Processing progress bar (replaces upload button) */}
      {isWorking && (
        <div className="p-4 rounded-xl bg-surface-alt border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-accent animate-spin" />
              <span className="text-sm text-text-primary font-medium">
                {stageName}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="h-7 px-3 rounded-lg border border-border text-text-secondary text-xs font-medium hover:text-error hover:border-error/30 hover:bg-error/5 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Square className="h-3 w-3" />
              {cancelling ? "Отмена..." : "Остановить"}
            </button>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">Прогресс</span>
              <span className="text-text-primary font-medium tabular-nums">
                {progress}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full bg-accent transition-all duration-500",
                  progress < 100 &&
                    "bg-gradient-to-r from-accent to-accent/70 bg-[length:20px_100%] animate-[progress-stripes_1s_linear_infinite]"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Upload zone — shown when NONE/ERROR (not working) */}
      {!isWorking && (status === "NONE" || status === "ERROR") && (
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
              : "border-border hover:border-border-hover hover:bg-surface-alt"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept={ACCEPTED_FORMATS}
          />
          <Upload className="h-8 w-8 text-text-secondary mx-auto mb-2" />
          <p className="text-sm text-text-secondary">
            Перетащите файлы или нажмите для выбора
          </p>
          <p className="text-xs text-text-muted mt-1">
            PDF, DOCX, XLSX, TXT, CSV, HTML до 100 МБ
          </p>
        </div>
      )}

      {/* Staged files (pending upload) */}
      {stagedFiles.length > 0 && !isWorking && (
        <div className="space-y-2">
          {stagedFiles.map((file, i) => (
            <div
              key={`staged-${i}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20"
            >
              <FileText className="h-4 w-4 text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {file.name}
                </p>
                <p className="text-xs text-warning">
                  {formatSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeStagedFile(i)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={handleUploadAndProcess}
            className="w-full h-10 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            Загрузить и обработать ({stagedFiles.length})
          </button>
        </div>
      )}

      {/* Published/Ready state — file list + actions */}
      {!isWorking && (status === "PUBLISHED" || status === "READY") && (
        <>
          {/* Status header */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-success/5 border border-success/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-text-primary">
                {status === "PUBLISHED"
                  ? "База знаний активна"
                  : "Обработка завершена"}
              </span>
              {toolCount !== undefined && toolCount > 0 && (
                <span className="text-xs text-text-secondary">
                  ({toolCount} инструментов)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Add more files */}
              <input
                ref={inputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept={ACCEPTED_FORMATS}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="h-7 px-3 rounded-lg border border-border text-text-secondary text-xs font-medium hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="h-3 w-3" />
                Добавить
              </button>
              {/* Delete knowledge */}
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="h-7 px-3 rounded-lg bg-error text-white text-xs font-medium hover:bg-error/90 transition-colors cursor-pointer"
                  >
                    {deleting ? "Удаление..." : "Да, удалить"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="h-7 px-2 rounded-lg border border-border text-text-secondary text-xs hover:bg-surface-alt transition-colors cursor-pointer"
                  >
                    Нет
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-alt/50"
                >
                  <FileText className="h-3.5 w-3.5 text-text-muted shrink-0" />
                  <span className="text-sm text-text-primary truncate flex-1">
                    {file.fileName}
                  </span>
                  <span className="text-xs text-text-secondary shrink-0 tabular-nums">
                    {formatSize(file.fileSize)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Helper text — empty state */}
      {status === "NONE" && files.length === 0 && stagedFiles.length === 0 && !isWorking && (
        <p className="text-xs text-text-muted">
          Загрузите документы для создания базы знаний. Агент получит инструменты
          семантического поиска по содержимому файлов.
        </p>
      )}
    </div>
  );
}
