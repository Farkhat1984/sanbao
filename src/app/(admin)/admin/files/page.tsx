"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { File, HardDrive, Trash2, Recycle, ChevronLeft, ChevronRight } from "lucide-react";

interface FileStats {
  totalFiles: number;
  totalSize: number;
  storageConfigured?: boolean;
  byUser: { userId: string; userName: string; fileCount: number; totalSize: number }[];
  recentFiles: { id: string; fileName: string; fileType: string; fileSize: number; userId: string; userName: string; createdAt: string }[];
  recentTotal: number;
  page: number;
  limit: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export default function AdminFilesPage() {
  const [stats, setStats] = useState<FileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ deletedFiles: number; deletedRecords: number; freedMb: number } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filePage, setFilePage] = useState(1);
  const FILES_PER_PAGE = 50;

  const fetchStats = useCallback(() => {
    const params = new URLSearchParams({
      page: String(filePage),
      limit: String(FILES_PER_PAGE),
    });
    fetch(`/api/admin/files?${params}`)
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); });
  }, [filePage]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleCleanup = async () => {
    if (!confirm("Удалить осиротевшие файлы? Будут удалены файлы без записи в БД и записи без агентов.")) return;
    setCleaning(true);
    setCleanupResult(null);
    const res = await fetch("/api/admin/files", { method: "POST" });
    const data = await res.json();
    setCleanupResult(data);
    setCleaning(false);
    fetchStats();
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Удалить этот файл?")) return;
    setDeleting(fileId);
    await fetch("/api/admin/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, type: "agent" }),
    });
    setDeleting(null);
    fetchStats();
  };

  if (loading || !stats) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-24" />)}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">Файлы</h1>
          <p className="text-sm text-text-secondary mt-1">Загруженные файлы и использование хранилища</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleCleanup} isLoading={cleaning}>
            <Recycle className="h-3.5 w-3.5" />
            Очистка
          </Button>
          <Badge variant={stats.storageConfigured ? "accent" : "default"}>
            {stats.storageConfigured ? "S3 подключён" : "S3 не настроен"}
          </Badge>
        </div>
      </div>

      {/* Cleanup result */}
      {cleanupResult && (
        <div className="p-3 mb-6 rounded-xl bg-success-light border border-success/20">
          <p className="text-sm text-success">
            Очистка завершена: удалено {cleanupResult.deletedFiles} файлов с диска, {cleanupResult.deletedRecords} записей из БД.
            Освобождено: {cleanupResult.freedMb} МБ
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <File className="h-4 w-4 text-text-secondary" />
            <p className="text-xs text-text-secondary">Всего файлов</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{stats.totalFiles}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-4 w-4 text-text-secondary" />
            <p className="text-xs text-text-secondary">Общий размер</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{formatSize(stats.totalSize)}</p>
        </div>
      </div>

      {/* Usage by user */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Использование по пользователям</h2>
        <div className="space-y-2">
          {stats.byUser.map((u) => (
            <div key={u.userId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm text-text-primary">{u.userName}</span>
              <div className="flex items-center gap-3">
                <Badge variant="default">{u.fileCount} файлов</Badge>
                <span className="text-sm text-text-secondary">{formatSize(u.totalSize)}</span>
              </div>
            </div>
          ))}
          {stats.byUser.length === 0 && <p className="text-sm text-text-secondary text-center py-4">Нет загруженных файлов</p>}
        </div>
      </div>

      {/* Recent files */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Последние файлы</h2>
        <div className="space-y-2">
          {stats.recentFiles.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-primary truncate">{f.fileName}</span>
                  <Badge variant="default">{f.fileType}</Badge>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">{f.userName} &middot; {formatSize(f.fileSize)} &middot; {new Date(f.createdAt).toLocaleDateString("ru-RU")}</p>
              </div>
              <button
                onClick={() => handleDelete(f.id)}
                disabled={deleting === f.id}
                className="ml-2 p-1.5 rounded-lg text-text-secondary hover:text-error hover:bg-error-light transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {stats.recentFiles.length === 0 && <p className="text-sm text-text-secondary text-center py-4">Нет файлов</p>}

          {/* Pagination */}
          {(() => {
            const totalPages = Math.ceil((stats.recentTotal || stats.totalFiles) / FILES_PER_PAGE);
            if (totalPages <= 1) return null;
            return (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-text-secondary">{stats.recentTotal || stats.totalFiles} файлов</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilePage((p) => Math.max(1, p - 1))}
                    disabled={filePage === 1}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-text-secondary">{filePage} / {totalPages}</span>
                  <button
                    onClick={() => setFilePage((p) => Math.min(totalPages, p + 1))}
                    disabled={filePage === totalPages}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-alt disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
