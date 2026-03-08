// ─── Custom react-markdown components ────────────────────
// Shared markdown component overrides for ReactMarkdown.

import { ArrowSquareOut, Image } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ArticleLink } from "@/components/chat/ArticleLink";
import { SourceLink } from "@/components/chat/SourceLink";
import { openImageInPanel } from "@/lib/panel-actions";
import { defaultUrlTransform } from "react-markdown";

/** Allow article:// and source:// protocols through URL sanitization */
export function urlTransform(url: string): string {
  if (url.startsWith("article://") || url.startsWith("source://")) return url;
  return defaultUrlTransform(url);
}

export const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="table-wrapper">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    // source://domain/file.pdf/chunk_index → clickable SourceLink (internal panel)
    if (href?.startsWith("source://")) {
      const raw = href.replace("source://", "").replace(/\/+$/, "");
      // Parse: domain/source_file/chunk_index
      const parts = raw.split("/");
      if (parts.length >= 3) {
        const domain = parts[0];
        const chunkIndex = parseInt(parts[parts.length - 1], 10);
        const sourceFile = parts.slice(1, -1).join("/");
        if (domain && sourceFile && !isNaN(chunkIndex)) {
          return <SourceLink domain={domain} sourceFile={sourceFile} chunkIndex={chunkIndex}>{children}</SourceLink>;
        }
      }
      return <span className="text-accent font-medium">{children}</span>;
    }
    // article://criminal_code/188 → clickable ArticleLink (internal panel)
    if (href?.startsWith("article://")) {
      const raw = href.replace("article://", "").replace(/\/+$/, ""); // strip trailing slashes
      const slashIdx = raw.indexOf("/");
      const code = slashIdx > 0 ? raw.slice(0, slashIdx) : raw;
      const article = slashIdx > 0 ? raw.slice(slashIdx + 1) : "";
      if (code && article) {
        return <ArticleLink code={code} article={article}>{children}</ArticleLink>;
      }
      // Malformed article:// (no article number) — render as plain text, never <a>
      return <span className="text-legal-ref font-medium">&sect; {children}</span>;
    }
    // External links → open in new browser tab
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline inline-flex items-center gap-0.5"
      >
        {children}
        <ArrowSquareOut weight="duotone" className="h-3 w-3 inline shrink-0 opacity-40" />
      </a>
    );
  },
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <button
      type="button"
      onClick={() => typeof props.src === "string" && openImageInPanel(props.src, String(props.alt || ""))}
      className="my-2 flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border hover:border-accent hover:shadow-sm transition-all cursor-pointer text-left group/img"
    >
      <div className="h-10 w-10 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
        <Image weight="duotone" className="h-5 w-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{props.alt || "Изображение"}</p>
        <p className="text-xs text-text-secondary">Нажмите чтобы открыть</p>
      </div>
      <ArrowSquareOut weight="duotone" className="h-4 w-4 text-text-secondary group-hover/img:text-accent transition-colors shrink-0" />
    </button>
  ),
  code: ({
    className,
    children,
    ...props
  }: {
    className?: string;
    children?: React.ReactNode;
  }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-black/10 rounded px-1 py-0.5 text-[13px] font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className={cn("text-[13px]", className)} {...props}>
        {children}
      </code>
    );
  },
};
