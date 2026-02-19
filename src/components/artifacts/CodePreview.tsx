"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { RefreshCw, Maximize2, Minimize2, Wrench, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { REACT_CDN_URL, REACT_DOM_CDN_URL, BABEL_CDN_URL, TAILWIND_CDN_URL, PYODIDE_CDN_URL } from "@/lib/constants";

interface CodePreviewProps {
  code: string;
  onRequestChatFix?: (error: string) => void;
}

export function isPythonCode(raw: string): boolean {
  // Fence explicitly marked as python/py
  if (/^```(?:python|py)\n/i.test(raw.trim())) return true;
  // Strip any fences before checking syntax markers
  const stripped = raw.replace(/^```\w*\n|```$/gm, "").trim();
  const markers = [
    /^def\s+\w+\s*\(/m,
    /^import\s+\w+/m,
    /^from\s+\w+\s+import\s/m,
    /\bprint\s*\(/,
    /^class\s+\w+.*:/m,
    /if\s+__name__\s*==\s*['"]__main__['"]/,
  ];
  const hits = markers.filter((r) => r.test(stripped)).length;
  return hits >= 2;
}

// Map of Python imports to Pyodide package names
const PYODIDE_PACKAGE_MAP: Record<string, string> = {
  pygame: "pygame-ce",
  numpy: "numpy",
  pandas: "pandas",
  matplotlib: "matplotlib",
  scipy: "scipy",
  sklearn: "scikit-learn",
  PIL: "Pillow",
  cv2: "opencv-python",
  sympy: "sympy",
  requests: "requests",
  yaml: "pyyaml",
  bs4: "beautifulsoup4",
};

function detectPythonImports(code: string): string[] {
  const packages = new Set<string>();
  const importRegex = /^(?:import|from)\s+([\w]+)/gm;
  let m;
  while ((m = importRegex.exec(code)) !== null) {
    const mod = m[1];
    if (PYODIDE_PACKAGE_MAP[mod]) {
      packages.add(PYODIDE_PACKAGE_MAP[mod]);
    }
  }
  return [...packages];
}

function buildPythonHtml(code: string): string {
  let cleanCode = code.trim();
  const fenceMatch = cleanCode.match(/^```(?:python|py)?\n([\s\S]*?)```$/);
  if (fenceMatch) cleanCode = fenceMatch[1].trim();

  const usesMpl = /\bmatplotlib\b/.test(cleanCode) || /\bplt\b/.test(cleanCode);
  const usesPygame = /\bpygame\b/.test(cleanCode);
  const packages = detectPythonImports(cleanCode);

  // Try to extract canvas size from pygame.display.set_mode((W, H))
  let canvasW = 600, canvasH = 400;
  if (usesPygame) {
    const sizeMatch = cleanCode.match(/set_mode\s*\(\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (sizeMatch) {
      canvasW = parseInt(sizeMatch[1], 10);
      canvasH = parseInt(sizeMatch[2], 10);
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #fff; color: #1a1a1a; padding: 16px; }
    #output { white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-family: 'Courier New', monospace; font-size: 14px; }
    #plot { margin-top: 12px; text-align: center; }
    #plot img, #canvas { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    #loading { color: #888; }
    .error { color: #dc2626; }
  </style>
</head>
<body>
  <div id="loading">Загрузка Python...</div>
  <pre id="output"></pre>
  <div id="plot"></div>
  ${usesPygame ? `<canvas id="canvas" width="${canvasW}" height="${canvasH}" tabindex="1"></canvas>` : ""}
  <script>
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

  ${usesPygame ? `
  // Emscripten SDL2 needs Module.canvas before anything loads
  window.Module = {
    canvas: document.getElementById('canvas'),
    arguments: [],
    noInitialRun: true
  };
  ` : ""}
  </script>
  <script src="${PYODIDE_CDN_URL}"></script>
  <script>
  (async function() {
    var output = document.getElementById('output');
    var loading = document.getElementById('loading');

    try {
      var pyodide = await loadPyodide({
        indexURL: "${PYODIDE_CDN_URL.replace("/pyodide.js", "/")}"
      });
      loading.textContent = 'Установка пакетов...';

      // Install required packages
      ${packages.length > 0 ? `
      await pyodide.loadPackage("micropip");
      var micropip = pyodide.pyimport("micropip");
      var pkgs = ${JSON.stringify(packages)};
      for (var i = 0; i < pkgs.length; i++) {
        loading.textContent = 'Установка ' + pkgs[i] + '...';
        try {
          await pyodide.loadPackage(pkgs[i]);
        } catch(_) {
          try { await micropip.install(pkgs[i]); } catch(_2) {}
        }
      }
      ` : ""}

      loading.textContent = '';

      // Redirect stdout/stderr
      pyodide.runPython(\`
import sys

class _OutputCapture:
    def __init__(self):
        pass
    def write(self, text):
        if text:
            from js import document
            el = document.getElementById("output")
            el.textContent += text
    def flush(self):
        pass

sys.stdout = _OutputCapture()
sys.stderr = _OutputCapture()
\`);

      // Provide input() via browser prompt
      pyodide.runPython(\`
import builtins
from js import prompt as _js_prompt

def _browser_input(text=""):
    result = _js_prompt(str(text))
    if result is None:
        raise EOFError("User cancelled input")
    return str(result)

builtins.input = _browser_input
\`);

      ${usesMpl ? `
      pyodide.runPython(\`
import matplotlib
matplotlib.use("agg")
\`);
      ` : ""}

      ${usesPygame ? `
      // Configure SDL2 for Emscripten canvas rendering
      pyodide.runPython(\`
import os
os.environ["SDL_VIDEODRIVER"] = "emscripten"
os.environ["SDL_AUDIODRIVER"] = "dummy"
\`);
      // Ensure Emscripten Module.canvas is set for SDL2
      if (typeof Module !== 'undefined') {
        Module.canvas = document.getElementById('canvas');
      }
      ` : ""}

      var userCode = ${JSON.stringify(cleanCode)};

      ${usesPygame ? `
      // Patch pygame code for Emscripten async compatibility:
      // 1. Add 'import asyncio' if missing
      // 2. Make main() async
      // 3. Add 'await asyncio.sleep(0)' inside while loops to yield to browser event loop
      // 4. Replace 'main()' call with 'await main()' via asyncio
      if (userCode.indexOf('import asyncio') === -1) {
        userCode = 'import asyncio\\n' + userCode;
      }
      // Insert 'await asyncio.sleep(0)' after clock.tick() lines
      userCode = userCode.replace(
        /^(\\s*)(clock\\.tick\\(.*\\))/gm,
        '$1$2\\n$1await asyncio.sleep(0)'
      );
      // If no clock.tick, insert after pygame.display.flip()/update()
      if (userCode.indexOf('clock.tick') === -1) {
        userCode = userCode.replace(
          /^(\\s*)(pygame\\.display\\.(?:flip|update)\\(\\))/gm,
          '$1$2\\n$1await asyncio.sleep(0.016)'
        );
      }
      // Make the main function async
      userCode = userCode.replace(/^def main\\(/gm, 'async def main(');
      // Replace direct main() call with asyncio.run
      userCode = userCode.replace(
        /if\\s+__name__\\s*==\\s*['\\""]__main__['\\""]:\\s*\\n\\s*main\\(\\)/,
        'asyncio.ensure_future(main())'
      );
      // Fallback: if there's a standalone main() call at the end
      userCode = userCode.replace(/\\nmain\\(\\)\\s*$/, '\\nasyncio.ensure_future(main())');
      ` : ""}

      ${usesMpl ? `
      userCode += \`
import io, base64
import matplotlib.pyplot as _plt
for _fig_num in _plt.get_fignums():
    _fig = _plt.figure(_fig_num)
    _buf = io.BytesIO()
    _fig.savefig(_buf, format="png", dpi=100, bbox_inches="tight", facecolor="#ffffff")
    _buf.seek(0)
    _b64 = base64.b64encode(_buf.read()).decode()
    from js import document
    _img = document.createElement("img")
    _img.src = "data:image/png;base64," + _b64
    document.getElementById("plot").appendChild(_img)
_plt.close("all")
\`;
      ` : ""}

      await pyodide.runPythonAsync(userCode);

      window.parent.postMessage({type:'preview-ready'}, '*');
    } catch(e) {
      loading.textContent = '';
      var msg = e.message || e.toString();
      output.innerHTML += '<span class="error">' + msg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') + '</span>';
      window.parent.postMessage({type:'preview-error', message: msg}, '*');
    }
  })();
  </script>
</body>
</html>`;
}

/** Strip ES module import/export statements that don't work in browser script tags */
function stripImportsExports(code: string): string {
  return code
    // Remove: import { X } from 'pkg'; import X from 'pkg'; import 'pkg';
    .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, "")
    // Remove: export default X; export { X }; but keep the declaration
    .replace(/^export\s+default\s+(?=function|class|const|let|var)/gm, "")
    .replace(/^export\s+default\s+(\w+);?\s*$/gm, "")
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, "")
    .replace(/^export\s+(?=function|class|const|let|var)/gm, "")
    .trim();
}

function buildPreviewHtml(code: string): string {
  let cleanCode = code.trim();
  const fenceMatch = cleanCode.match(/^```(?:tsx?|jsx?|javascript|typescript|html)?\n([\s\S]*?)```$/);
  if (fenceMatch) {
    cleanCode = fenceMatch[1].trim();
  }

  // Python code — run via Pyodide
  if (isPythonCode(code)) {
    return buildPythonHtml(code);
  }

  // Strip import/export for non-HTML code (React/JSX) — they can't work in browser
  if (!/^\s*<!DOCTYPE|^\s*<html/i.test(cleanCode)) {
    cleanCode = stripImportsExports(cleanCode);
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
        // Scan all global functions/classes to find React components
        const knownNames = ['App','Main','Component','Page','Home','Demo','Example','Game','Chart','Dashboard','Calculator','Timer','Editor','Viewer','Player','Widget'];
        const candidates = knownNames
          .map(n => { try { return eval(n); } catch { return null; } })
          .filter(Boolean);
        // Fallback: find any PascalCase function that returns JSX
        if (candidates.length === 0) {
          const allVars = Object.keys(window).filter(k => /^[A-Z]/.test(k) && typeof window[k] === 'function');
          for (const k of allVars) {
            try { candidates.push(window[k]); break; } catch {}
          }
        }

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
