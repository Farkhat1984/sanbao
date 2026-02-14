"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { RefreshCw, AlertTriangle, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodePreviewProps {
  code: string;
}

function buildPreviewHtml(code: string): string {
  // Extract the code content — strip markdown code fences if present
  let cleanCode = code.trim();
  const fenceMatch = cleanCode.match(/^```(?:tsx?|jsx?|javascript|typescript)?\n([\s\S]*?)```$/);
  if (fenceMatch) {
    cleanCode = fenceMatch[1].trim();
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #root { min-height: 100vh; }
    #error-overlay {
      position: fixed; inset: 0; background: rgba(255,0,0,0.05);
      display: none; padding: 16px; z-index: 9999;
    }
    #error-overlay.visible { display: flex; flex-direction: column; align-items: center; justify-content: center; }
    #error-message {
      background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 12px;
      padding: 16px; max-width: 500px; font-size: 13px; color: #991B1B;
      font-family: monospace; white-space: pre-wrap; word-break: break-word;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error-overlay">
    <div id="error-message"></div>
  </div>
  <script>
    window.onerror = function(msg, url, line, col, error) {
      var overlay = document.getElementById('error-overlay');
      var message = document.getElementById('error-message');
      overlay.className = 'visible';
      message.textContent = (error ? error.toString() : msg) + '\\n\\nLine: ' + line;
      return true;
    };
  </script>
  <script type="text/babel" data-type="module">
    const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext, Fragment } = React;

    ${cleanCode}

    // Auto-detect and render the component
    ;(function() {
      try {
        // Try common export patterns
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
        } else {
          document.getElementById('error-message').textContent = 'No component found to render. Define a component named App, Main, Component, Page, Home, Demo, or Example.';
          document.getElementById('error-overlay').className = 'visible';
        }
      } catch(e) {
        document.getElementById('error-message').textContent = e.toString();
        document.getElementById('error-overlay').className = 'visible';
      }
    })();
  </script>
</body>
</html>`;
}

export function CodePreview({ code }: CodePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const blobUrl = useMemo(() => {
    const html = buildPreviewHtml(code);
    const blob = new Blob([html], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [code, key]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const handleRefresh = () => {
    setHasError(false);
    setKey((k) => k + 1);
  };

  return (
    <div className={cn(
      "h-full flex flex-col",
      isFullscreen && "fixed inset-0 z-50 bg-surface"
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-alt shrink-0">
        <span className="text-[10px] text-text-muted font-medium uppercase tracking-wide">
          Live Preview
        </span>
        <div className="flex items-center gap-1">
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

      {/* iframe */}
      <div className="flex-1 relative bg-white">
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-alt z-10">
            <div className="text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm text-text-secondary">Ошибка рендеринга</p>
              <button
                onClick={handleRefresh}
                className="text-xs text-accent hover:underline cursor-pointer"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={key}
          src={blobUrl}
          sandbox="allow-scripts"
          className="w-full h-full border-0"
          title="Code Preview"
          onError={() => setHasError(true)}
        />
      </div>
    </div>
  );
}
