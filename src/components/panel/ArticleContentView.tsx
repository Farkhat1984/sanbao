"use client";

import { useState, useEffect } from "react";
import { BookOpen, RotateCcw, Copy, Download, Check } from "lucide-react";
import { useArticleStore } from "@/stores/articleStore";
import { usePanelStore } from "@/stores/panelStore";
import { cn } from "@/lib/utils";
import { exportAsText } from "@/lib/export-utils";

const CODE_LABELS: Record<string, string> = {
  constitution: "Конституция РК",
  criminal_code: "УК РК",
  criminal_procedure: "УПК РК",
  civil_code_general: "ГК РК (Общая часть)",
  civil_code_special: "ГК РК (Особенная часть)",
  civil_procedure: "ГПК РК",
  admin_offenses: "КоАП РК",
  admin_procedure: "АППК РК",
  tax_code: "НК РК",
  labor_code: "ТК РК",
  land_code: "ЗК РК",
  ecological_code: "ЭК РК",
  entrepreneurship: "ПК РК",
  budget_code: "БК РК",
  customs_code: "ТамК РК",
  family_code: "КоБС РК",
  social_code: "СК РК",
  water_code: "ВК РК",
};

// ─── Skeleton loader ─────────────────────────────────────

function ArticleSkeleton() {
  return (
    <div className="px-4 py-4 space-y-3 animate-pulse">
      <div className="h-5 w-3/4 bg-text-muted/10 rounded" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-text-muted/10 rounded" />
        <div className="h-3 w-full bg-text-muted/10 rounded" />
        <div className="h-3 w-5/6 bg-text-muted/10 rounded" />
        <div className="h-3 w-full bg-text-muted/10 rounded" />
        <div className="h-3 w-4/5 bg-text-muted/10 rounded" />
      </div>
      <div className="h-px bg-border my-3" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-text-muted/10 rounded" />
        <div className="h-3 w-3/4 bg-text-muted/10 rounded" />
      </div>
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────

function ArticleError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center gap-3">
      <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
        <BookOpen className="h-6 w-6 text-red-500" />
      </div>
      <p className="text-sm text-text-muted">{error}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-alt border border-border hover:border-accent text-text-primary transition-colors cursor-pointer"
      >
        <RotateCcw className="h-3 w-3" />
        Повторить
      </button>
    </div>
  );
}

// ─── Article content view ────────────────────────────────

export function ArticleContentView() {
  const { activeArticle, loading, error, retry } = useArticleStore();
  const activeTabId = usePanelStore((s) => s.activeTabId);
  const tabs = usePanelStore((s) => s.tabs);
  const [copied, setCopied] = useState(false);

  // Sync activeArticle when panel tab switches
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || tab.kind !== "article" || !tab.articleKey) return;
    const { activeArticle: current, cache } = useArticleStore.getState();
    const currentKey = current ? `${current.code}/${current.article}` : null;
    if (currentKey === tab.articleKey) return;
    const cached = cache.get(tab.articleKey);
    if (cached) {
      useArticleStore.setState({ activeArticle: cached, loading: false, error: null });
    } else {
      const [code, article] = tab.articleKey.split("/");
      if (code && article) {
        useArticleStore.getState().openArticle(code, article);
      }
    }
  }, [activeTabId, tabs]);

  if (loading) return <ArticleSkeleton />;
  if (error) return <ArticleError error={error} onRetry={retry} />;
  if (!activeArticle) return null;

  const fullText = [
    activeArticle.title,
    "",
    activeArticle.text,
    activeArticle.annotation ? `\nПримечание: ${activeArticle.annotation}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const headerLabel = `Ст. ${activeArticle.article} ${CODE_LABELS[activeArticle.code] || activeArticle.code}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    exportAsText(fullText, `${headerLabel} - ${activeArticle.title}`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-4 w-4 text-legal-ref shrink-0" />
          <span className="text-sm font-semibold text-text-primary truncate">
            {headerLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
            title="Копировать"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
            title="Скачать"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
        <div className="px-4 py-4">
          {activeArticle.title && (
            <h3 className="text-base font-semibold text-text-primary mb-3">
              {activeArticle.title}
            </h3>
          )}
          <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {activeArticle.text}
          </div>
          {activeArticle.annotation && (
            <>
              <hr className="border-border my-4" />
              <div className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap">
                <span className="font-medium text-text-secondary">Примечание: </span>
                {activeArticle.annotation}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
