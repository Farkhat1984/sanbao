"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { RefreshCw, Maximize2, Minimize2, Wrench, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildPreviewHtml } from "@/lib/code-preview-builder";
import { MAX_AUTO_FIX_ATTEMPTS } from "@/lib/constants";

interface CodePreviewProps {
  code: string;
  /** File data map (filename → CSV) for large tabular files — injected into Python sandbox */
  fileData?: Record<string, string>;
  /** Called when auto-fix produces new code — parent should update the artifact */
  onAutoFixed?: (fixedCode: string) => void;
  onRequestChatFix?: (error: string) => void;
}

export { isPythonCode } from "@/lib/code-preview-builder";

export function CodePreview({ code, fileData, onAutoFixed, onRequestChatFix }: CodePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sentToChat, setSentToChat] = useState(false);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [autoFixAttempt, setAutoFixAttempt] = useState(0);
  const autoFixRef = useRef(0); // track attempts across renders

  const html = useMemo(() => buildPreviewHtml(code, fileData), [code, fileData, key]);

  // Reset state when code changes
  useEffect(() => {
    setHasError(false);
    setErrorMessage("");
    setSentToChat(false);
    setIsAutoFixing(false);
    // Don't reset autoFixAttempt here — it persists across fix cycles
  }, [code]);

  // Auto-fix: call /api/fix-code and update artifact
  const attemptAutoFix = useCallback(async (error: string, currentCode: string) => {
    if (autoFixRef.current >= MAX_AUTO_FIX_ATTEMPTS) return;
    autoFixRef.current++;
    setAutoFixAttempt(autoFixRef.current);
    setIsAutoFixing(true);

    try {
      const res = await fetch("/api/fix-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: currentCode, error }),
      });

      if (!res.ok) {
        setIsAutoFixing(false);
        return;
      }

      const { fixedCode } = await res.json();
      if (fixedCode && fixedCode !== currentCode && onAutoFixed) {
        setHasError(false);
        setErrorMessage("");
        onAutoFixed(fixedCode);
      } else {
        setIsAutoFixing(false);
      }
    } catch {
      setIsAutoFixing(false);
    }
  }, [onAutoFixed]);

  // Listen for postMessage from iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.origin !== "null" && e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== "object") return;

      if (e.data.type === "preview-error") {
        const err = e.data.message || "Unknown error";
        setHasError(true);
        setErrorMessage(err);
        setIsAutoFixing(false);

        // Auto-fix if we haven't exceeded attempts and onAutoFixed is provided
        if (onAutoFixed && autoFixRef.current < MAX_AUTO_FIX_ATTEMPTS) {
          attemptAutoFix(err, code);
        }
      } else if (e.data.type === "preview-ready") {
        setHasError(false);
        setErrorMessage("");
        setIsAutoFixing(false);
        // Reset attempt counter on success
        autoFixRef.current = 0;
        setAutoFixAttempt(0);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [code, onAutoFixed, attemptAutoFix]);

  const handleRequestFix = () => {
    if (!onRequestChatFix || !errorMessage) return;
    onRequestChatFix(errorMessage);
    setSentToChat(true);
  };

  const handleRefresh = () => {
    setHasError(false);
    setErrorMessage("");
    autoFixRef.current = 0;
    setAutoFixAttempt(0);
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
          <span className="text-[10px] text-text-secondary font-medium uppercase tracking-wide">
            Live Preview
          </span>
          {isAutoFixing && (
            <span className="flex items-center gap-1 text-[10px] text-warning font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              Авто-исправление ({autoFixAttempt}/{MAX_AUTO_FIX_ATTEMPTS})
            </span>
          )}
          {sentToChat && (
            <span className="flex items-center gap-1 text-[10px] text-success font-medium">
              <Check className="h-3 w-3" />
              Отправлено в чат
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasError && !isAutoFixing && onRequestChatFix && !sentToChat && (
            <button
              onClick={handleRequestFix}
              className="h-6 px-2 rounded-md flex items-center gap-1 text-[10px] text-warning hover:bg-surface transition-colors cursor-pointer"
              title="Исправить ошибку"
            >
              <Wrench className="h-3 w-3" />
              Исправить
            </button>
          )}
          <button
            onClick={handleRefresh}
            className="h-6 w-6 rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
            title="Обновить превью"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-6 w-6 rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
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
      {hasError && errorMessage && !isAutoFixing && (
        <div className="px-3 py-2 bg-error/10 border-b border-error/20 shrink-0">
          <pre className="text-[11px] text-error font-mono whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
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
