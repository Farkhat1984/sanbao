"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Database,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  FileText,
  X,
  Play,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Pipeline stage labels in Russian — keys match orchestrator SSE lowercase stage names */
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
  /** True when the user's plan does not support LeemaDB knowledge bases */
  disabled?: boolean;
  /** Called after upload/process/publish to refresh parent data */
  onRefresh?: () => void;
  /** Error message from the server (shown in ERROR state) */
  errorMessage?: string;
  /** Number of discovered MCP tools after publish */
  toolCount?: number;
}

interface ProgressEvent {
  stage?: string;
  progress?: number;
  message?: string;
  status?: string;
}

const MAX_KNOWLEDGE_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
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
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stageName, setStageName] = useState("Подготовка...");
  const inputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Sync props when parent refreshes
  useEffect(() => {
    setStatus(knowledgeStatus);
    setFiles(knowledgeFiles);
  }, [knowledgeStatus, knowledgeFiles]);

  /** Persist knowledge status to DB so it survives page refresh */
  const persistStatus = useCallback(
    async (newStatus: KnowledgeStatus) => {
      try {
        await fetch(`/api/agents/${agentId}/knowledge/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch {
        // Best-effort — the UI already updated locally
      }
    },
    [agentId]
  );

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
          setProgress(Math.min(data.progress, 100));
        }
        if (data.stage) {
          setStageName(STAGE_LABELS[data.stage] || data.stage);
        }
        if (data.message) {
          setStageName(data.message);
        }
        if (data.status === "completed" || data.status === "done") {
          setProgress(100);
          setStageName("Готово!");
          es.close();
          setStatus("READY");
          persistStatus("READY");
          onRefresh?.();
        }
        if (data.status === "error") {
          setStageName("Ошибка обработки");
          es.close();
          setStatus("ERROR");
          persistStatus("ERROR");
          onRefresh?.();
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
  }, [status, agentId, onRefresh, persistStatus]);

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

  const handleUpload = async () => {
    if (stagedFiles.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      stagedFiles.forEach((f) => formData.append("files", f));

      const res = await fetch(
        `/api/agents/${agentId}/knowledge/upload`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const text = await res.text();
        let msg = "Ошибка загрузки";
        try { msg = JSON.parse(text).error || msg; } catch { msg = text.slice(0, 200); }
        throw new Error(msg);
      }

      // Update local file list from response
      const uploaded = await res.json();
      if (Array.isArray(uploaded)) {
        setFiles((prev) => [...prev, ...uploaded.map((f: KnowledgeFile) => f)]);
      }
      setStagedFiles([]);
      setUploading(false);
      // Auto-start processing
      await handleProcess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    setError(null);
    setProgress(0);
    setStageName("Подготовка...");

    try {
      const res = await fetch(
        `/api/agents/${agentId}/knowledge/process`,
        { method: "POST" }
      );

      if (!res.ok) {
        const text = await res.text();
        let msg = "Ошибка запуска обработки";
        try { msg = JSON.parse(text).error || msg; } catch { /* HTML response */ }
        throw new Error(msg);
      }

      setStatus("PROCESSING");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запуска обработки");
    } finally {
      setProcessing(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/agents/${agentId}/knowledge/publish`,
        { method: "POST" }
      );

      if (!res.ok) {
        const text = await res.text();
        let msg = "Ошибка публикации";
        try { msg = JSON.parse(text).error || msg; } catch { /* HTML response */ }
        throw new Error(msg);
      }

      setStatus("PUBLISHED");
      onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка публикации");
    } finally {
      setPublishing(false);
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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-text-primary">
            База знаний LeemaDB
          </span>
        </div>
        <KnowledgeStatusBadge status={status} toolCount={toolCount} />
      </div>

      {/* Error banner */}
      {(status === "ERROR" || error) && (
        <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-error shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-error">
              {error || errorMessage || "Произошла ошибка при обработке файлов"}
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

      {/* Processing progress */}
      {status === "PROCESSING" && (
        <div className="p-4 rounded-xl bg-surface-alt border border-border space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-accent animate-spin" />
            <span className="text-sm text-text-primary font-medium">
              Обработка файлов
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{stageName}</span>
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

      {/* Upload zone (shown in NONE state, or PUBLISHED/READY when user is staging new files) */}
      {(status === "NONE" || (status === "PUBLISHED" && stagedFiles.length > 0) || (status === "READY" && stagedFiles.length > 0)) && (
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
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept={ACCEPTED_FORMATS}
            />
            {uploading ? (
              <Loader2 className="h-8 w-8 text-accent mx-auto mb-2 animate-spin" />
            ) : (
              <Upload className="h-8 w-8 text-text-secondary mx-auto mb-2" />
            )}
            <p className="text-sm text-text-secondary">
              {uploading
                ? "Загрузка..."
                : "Перетащите файлы или нажмите для выбора"}
            </p>
            <p className="text-xs text-text-muted mt-1">
              PDF, DOCX, XLSX, TXT, CSV, HTML до 100 МБ
            </p>
          </div>
        )}

      {/* "Add more files" trigger for PUBLISHED/READY states when no staged files yet */}
      {(status === "PUBLISHED" || status === "READY") && stagedFiles.length === 0 && (
        <div className="relative">
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
            className="w-full h-9 rounded-xl border border-dashed border-border text-sm text-text-secondary hover:text-text-primary hover:border-border-hover hover:bg-surface-alt transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            Добавить файлы
          </button>
        </div>
      )}

      {/* Staged files (pending upload) */}
      {stagedFiles.length > 0 && (
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
                  {formatSize(file.size)} · ожидает загрузки
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
            onClick={handleUpload}
            disabled={uploading}
            className="w-full h-9 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading
              ? "Загрузка..."
              : `Загрузить ${stagedFiles.length} файл(ов)`}
          </button>
        </div>
      )}

      {/* Existing knowledge file list */}
      {files.length > 0 && status !== "PROCESSING" && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-alt border border-border"
            >
              <FileText className="h-4 w-4 text-text-secondary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {file.fileName}
                </p>
                <p className="text-xs text-text-secondary">
                  {formatSize(file.fileSize)}
                </p>
              </div>
              {status === "PUBLISHED" && (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  индексирован
                </span>
              )}
              {status === "READY" && (
                <span className="inline-flex items-center gap-1 text-xs text-accent">
                  <CheckCircle2 className="h-3 w-3" />
                  обработан
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {status === "NONE" && files.length > 0 && stagedFiles.length === 0 && (
        <button
          type="button"
          onClick={handleProcess}
          disabled={processing}
          className="h-9 px-4 rounded-xl bg-warning text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {processing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {processing ? "Запуск..." : "Обработать"}
        </button>
      )}

      {status === "READY" && stagedFiles.length === 0 && (
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing}
          className="h-9 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
        >
          {publishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {publishing ? "Публикация..." : "Опубликовать"}
        </button>
      )}

      {/* Helper text */}
      {status === "NONE" && files.length === 0 && stagedFiles.length === 0 && (
        <p className="text-xs text-text-muted">
          Загрузите файлы для обработки через AI-пайплайн. Агент получит
          возможность поиска по содержимому с помощью векторного индекса.
        </p>
      )}
    </div>
  );
}

/** Status badge shown in the section header */
function KnowledgeStatusBadge({
  status,
  toolCount,
}: {
  status: KnowledgeStatus;
  toolCount?: number;
}) {
  switch (status) {
    case "PROCESSING":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-warning/10 text-warning text-xs font-medium">
          <Loader2 className="h-3 w-3 animate-spin" />
          Обработка
        </span>
      );
    case "READY":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-xs font-medium">
          <CheckCircle2 className="h-3 w-3" />
          Обработано
        </span>
      );
    case "PUBLISHED":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-success/10 text-success text-xs font-medium">
          <CheckCircle2 className="h-3 w-3" />
          Опубликовано
          {toolCount !== undefined && toolCount > 0 && (
            <span className="ml-1 text-success/70">
              ({toolCount} инстр.)
            </span>
          )}
        </span>
      );
    case "ERROR":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-error/10 text-error text-xs font-medium">
          <AlertCircle className="h-3 w-3" />
          Ошибка
        </span>
      );
    default:
      return null;
  }
}
