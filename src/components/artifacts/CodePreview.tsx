"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { RefreshCw, Maximize2, Minimize2, Wrench, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildPreviewHtml } from "@/lib/code-preview-builder";

interface CodePreviewProps {
  code: string;
  onRequestChatFix?: (error: string) => void;
}

export { isPythonCode } from "@/lib/code-preview-builder";

export function CodePreview({ code, onRequestChatFix }: CodePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sentToChat, setSentToChat] = useState(false);

  const html = useMemo(() => buildPreviewHtml(code), [code, key]);

  // Reset errors when code changes
  useEffect(() => {
    setHasError(false);
    setErrorMessage("");
    setSentToChat(false);
  }, [code]);

  // Listen for postMessage from iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      // Origin check: accept same-origin or "null" (srcdoc iframes)
      if (e.origin !== "null" && e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "preview-error") {
        setHasError(true);
        setErrorMessage(e.data.message || "Unknown error");
      } else if (e.data.type === "preview-ready") {
        setHasError(false);
        setErrorMessage("");
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleRequestFix = () => {
    if (!onRequestChatFix || !errorMessage) return;
    onRequestChatFix(errorMessage);
    setSentToChat(true);
  };

  const handleRefresh = () => {
    setHasError(false);
    setErrorMessage("");
    setKey((k) => k + 1);
  };

  return (
    <div className={cn(
      "h-full flex flex-col",
      isFullscreen && "fixed inset-0 z-50 bg-surface"
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-alt shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted font-medium uppercase tracking-wide">
            Live Preview
          </span>
          {sentToChat && (
            <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium">
              <Check className="h-3 w-3" />
              Отправлено в чат
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasError && onRequestChatFix && !sentToChat && (
            <button
              onClick={handleRequestFix}
              className="h-6 px-2 rounded-md flex items-center gap-1 text-[10px] text-amber-500 hover:bg-surface transition-colors cursor-pointer"
              title="Исправить ошибку"
            >
              <Wrench className="h-3 w-3" />
              Исправить
            </button>
          )}
          <button
            onClick={handleRefresh}
            className="h-6 w-6 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
            title="Обновить превью"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-6 w-6 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
            title={isFullscreen ? "Свернуть" : "На весь экран"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Error bar */}
      {hasError && errorMessage && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 shrink-0">
          <pre className="text-[11px] text-red-400 font-mono whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
            {errorMessage}
          </pre>
        </div>
      )}

      {/* iframe — srcdoc instead of blob URL */}
      <div className="flex-1 relative bg-white">
        <iframe
          ref={iframeRef}
          key={key}
          srcDoc={html}
          sandbox="allow-scripts"
          className="w-full h-full border-0"
          title="Code Preview"
        />
      </div>
    </div>
  );
}
