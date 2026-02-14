"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { RefreshCw, Maximize2, Minimize2, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { REACT_CDN_URL, REACT_DOM_CDN_URL, BABEL_CDN_URL, TAILWIND_CDN_URL, MAX_AUTO_FIX_ATTEMPTS } from "@/lib/constants";

interface CodePreviewProps {
  code: string;
  onCodeFixed?: (fixedCode: string) => void;
}

function buildPreviewHtml(code: string): string {
  let cleanCode = code.trim();
  const fenceMatch = cleanCode.match(/^```(?:tsx?|jsx?|javascript|typescript|html)?\n([\s\S]*?)```$/);
  if (fenceMatch) {
    cleanCode = fenceMatch[1].trim();
  }

  // Error reporter script — injected into any HTML
  const errorReporter = `<script>
(function(){
  window.onerror = function(msg, url, line, col, error) {
    var text = (error ? (error.stack || error.toString()) : String(msg));
    if (line) text += '\\nLine: ' + line;
    window.parent.postMessage({type:'preview-error', message: text}, '*');
    return false;
  };
  window.addEventListener('unhandledrejection', function(e) {
    window.parent.postMessage({type:'preview-error', message:'Unhandled Promise: ' + (e.reason ? e.reason.toString() : 'unknown')}, '*');
  });
})();
<\/script>`;

  const readySignal = `<script>window.parent.postMessage({type:'preview-ready'}, '*');<\/script>`;

  // Full HTML document — inject error reporter
  if (/^\s*<!DOCTYPE|^\s*<html/i.test(cleanCode)) {
    if (cleanCode.includes('</head>')) {
      cleanCode = cleanCode.replace('</head>', errorReporter + '</head>');
    } else if (/<body/i.test(cleanCode)) {
      cleanCode = cleanCode.replace(/<body([^>]*)>/i, '<body$1>' + errorReporter);
    } else {
      cleanCode = errorReporter + cleanCode;
    }
    // Add ready signal before </body> or at the end
    if (cleanCode.includes('</body>')) {
      cleanCode = cleanCode.replace('</body>', readySignal + '</body>');
    } else {
      cleanCode += readySignal;
    }
    return cleanCode;
  }

  // React/JSX code — wrap in full HTML shell
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="${REACT_CDN_URL}" crossorigin><\/script>
  <script src="${REACT_DOM_CDN_URL}" crossorigin><\/script>
  <script src="${BABEL_CDN_URL}"><\/script>
  <script src="${TAILWIND_CDN_URL}"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #root { min-height: 100vh; }
  </style>
  ${errorReporter}
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module">
    const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext, Fragment } = React;

    ${cleanCode}

    ;(function() {
      try {
        const candidates = [
          typeof App !== 'undefined' ? App : null,
          typeof Main !== 'undefined' ? Main : null,
          typeof Component !== 'undefined' ? Component : null,
          typeof Page !== 'undefined' ? Page : null,
          typeof Home !== 'undefined' ? Home : null,
          typeof Demo !== 'undefined' ? Demo : null,
          typeof Example !== 'undefined' ? Example : null,
        ].filter(Boolean);

        const RootComponent = candidates[0];
        if (RootComponent) {
          const root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(RootComponent));
          window.parent.postMessage({type:'preview-ready'}, '*');
        } else {
          window.parent.postMessage({type:'preview-error', message:'No component found. Define: App, Main, Component, Page, Home, Demo, or Example.'}, '*');
        }
      } catch(e) {
        window.parent.postMessage({type:'preview-error', message: e.stack || e.toString()}, '*');
      }
    })();
  <\/script>
</body>
</html>`;
}

const MAX_FIX_ATTEMPTS = MAX_AUTO_FIX_ATTEMPTS;

export function CodePreview({ code, onCodeFixed }: CodePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixAttempts, setFixAttempts] = useState(0);

  const html = useMemo(() => buildPreviewHtml(code), [code, key]);

  // Reset errors when code changes
  useEffect(() => {
    setHasError(false);
    setErrorMessage("");
    setFixAttempts(0);
  }, [code]);

  // Listen for postMessage from iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
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

  // Auto-fix on error
  useEffect(() => {
    if (!hasError || !errorMessage || isFixing || !onCodeFixed) return;
    if (fixAttempts >= MAX_FIX_ATTEMPTS) return;

    const timer = setTimeout(() => {
      doAutoFix();
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasError, errorMessage]);

  const doAutoFix = useCallback(async () => {
    if (!onCodeFixed || isFixing) return;
    setIsFixing(true);
    setFixAttempts((prev) => prev + 1);

    try {
      const res = await fetch("/api/fix-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, error: errorMessage }),
      });

      if (!res.ok) {
        setIsFixing(false);
        return;
      }

      const data = await res.json();
      if (data.fixedCode && data.fixedCode !== code) {
        onCodeFixed(data.fixedCode);
      }
    } catch {
      // silently fail
    } finally {
      setIsFixing(false);
    }
  }, [code, errorMessage, onCodeFixed, isFixing]);

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
          {isFixing && (
            <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              Автоисправление...
            </span>
          )}
          {hasError && !isFixing && fixAttempts >= MAX_FIX_ATTEMPTS && (
            <span className="text-[10px] text-red-400 font-medium">
              Не удалось исправить
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasError && onCodeFixed && fixAttempts < MAX_FIX_ATTEMPTS && !isFixing && (
            <button
              onClick={doAutoFix}
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
      {hasError && errorMessage && !isFixing && (
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
