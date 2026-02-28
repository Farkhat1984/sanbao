// ─── Custom react-markdown components ────────────────────
// Shared markdown component overrides for ReactMarkdown.

import { ExternalLink, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArticleLink } from "@/components/chat/ArticleLink";
import { openImageInPanel } from "@/lib/panel-actions";
import { defaultUrlTransform } from "react-markdown";

/** Allow article:// protocol through URL sanitization */
export function urlTransform(url: string): string {
  if (url.startsWith("article://")) return url;
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
        <ExternalLink className="h-3 w-3 inline shrink-0 opacity-40" />
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
        <Image className="h-5 w-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{props.alt || "Изображение"}</p>
        <p className="text-xs text-text-muted">Нажмите чтобы открыть</p>
      </div>
      <ExternalLink className="h-4 w-4 text-text-muted group-hover/img:text-accent transition-colors shrink-0" />
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
