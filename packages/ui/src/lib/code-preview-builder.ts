// ─── Code preview HTML builders ──────────────────────────
// Generates sandboxed HTML for live code preview (React/JSX, plain HTML, Python).
// React/JSX uses import maps + esm.sh for native ESM imports (Three.js, recharts, etc.)

import {
  BABEL_CDN_URL,
  TAILWIND_CDN_URL,
  PYODIDE_CDN_URL,
  ESM_CDN_BASE,
  IMPORTMAP_PACKAGES,
} from "@/lib/constants";

// ─── Python detection ────────────────────────────────────

export function isPythonCode(raw: string): boolean {
  // Fence explicitly marked as python/py
  if (/^```(?:python|py)\n/i.test(raw.trim())) return true;
  // Fence explicitly marked as JS/TS/JSX/TSX/HTML — NOT Python
  if (/^```(?:jsx?|tsx?|javascript|typescript|html)\n/i.test(raw.trim())) return false;

  const stripped = raw.replace(/^```\w*\n|```$/gm, "").trim();

  // JS/React disqualifiers — if any match, it's definitely not Python
  const jsMarkers = [
    /\bconst\s+\w+\s*=/m,           // const x =
    /\blet\s+\w+\s*=/m,             // let x =
    /=>/,                            // arrow function
    /\bfunction\s+\w+\s*\(/m,       // function name(
    /<[A-Z]\w+[\s/>]/,               // JSX component <Component
    /<div[\s>]/,                     // JSX <div
    /import\s+.*\s+from\s+['"]/m,   // import X from 'pkg' (ES module)
    /import\s*\{[^}]+\}\s*from/m,   // import { X } from 'pkg'
    /React\./,                       // React.createElement etc.
    /useState|useEffect|useRef/,     // React hooks
    /document\.\w+/,                 // document.getElementById etc.
  ];
  if (jsMarkers.some((r) => r.test(stripped))) return false;

  // Python markers
  const pyMarkers = [
    /^def\s+\w+\s*\(/m,
    /^from\s+\w+\s+import\s/m,      // from X import Y (Python-specific)
    /\bprint\s*\(/,
    /^class\s+\w+.*:/m,             // class Foo: (with colon)
    /if\s+__name__\s*==\s*['"]__main__['"]/,
    /^\s*#\s*\w/m,                   // Python comments
    /\bself\.\w+/,                   // self.attribute
    /\bdef\s+__\w+__/m,             // dunder methods
    /\bimport\s+(?:pandas|numpy|matplotlib|plotly|scipy|pygame|sympy|csv|json|os|sys|re|math)\b/,
  ];
  const hits = pyMarkers.filter((r) => r.test(stripped)).length;
  return hits >= 2;
}

// ─── Python package detection ────────────────────────────

// Map of Python imports to Pyodide package names
const PYODIDE_PACKAGE_MAP: Record<string, string> = {
  pygame: "pygame-ce",
  numpy: "numpy",
  pandas: "pandas",
  matplotlib: "matplotlib",
  plotly: "plotly",
  scipy: "scipy",
  sklearn: "scikit-learn",
  PIL: "Pillow",
  cv2: "opencv-python",
  sympy: "sympy",
  requests: "requests",
  yaml: "pyyaml",
  bs4: "beautifulsoup4",
  openpyxl: "openpyxl",
  xlrd: "xlrd",
  json: "",    // built-in, no install needed
  csv: "",     // built-in
  re: "",      // built-in
  math: "",    // built-in
  os: "",      // built-in
  sys: "",     // built-in
};

function detectPythonImports(code: string): string[] {
  const packages = new Set<string>();
  const importRegex = /^(?:import|from)\s+([\w]+)/gm;
  let m;
  while ((m = importRegex.exec(code)) !== null) {
    const mod = m[1];
    const pkg = PYODIDE_PACKAGE_MAP[mod];
    if (pkg) {  // skip empty strings (built-in modules)
      packages.add(pkg);
    }
  }
  return [...packages];
}

// ─── Python HTML builder ─────────────────────────────────

export function buildPythonHtml(code: string): string {
  let cleanCode = code.trim();
  const fenceMatch = cleanCode.match(/^```(?:python|py)?\n([\s\S]*?)```$/);
  if (fenceMatch) cleanCode = fenceMatch[1].trim();

  const usesMpl = /\bmatplotlib\b/.test(cleanCode) || /\bplt\b/.test(cleanCode);
  const usesPlotly = /\bplotly\b/.test(cleanCode);
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
  ${usesPlotly ? `<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"><\/script>` : ""}
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

    // Screenshot capture via postMessage
    window.addEventListener('message', function(e) {
      if (!e.data || e.data.type !== 'capture-screenshot') return;
      try {
        if (typeof Plotly !== 'undefined') {
          var plots = document.querySelectorAll('.js-plotly-plot');
          if (plots.length > 0) {
            Plotly.toImage(plots[0], {format:'png', width:1200, height:800, scale:2})
              .then(function(url) {
                window.parent.postMessage({type:'screenshot-result', dataUrl: url}, '*');
              });
            return;
          }
        }
        var canvas = document.querySelector('canvas');
        if (canvas) {
          window.parent.postMessage({type:'screenshot-result', dataUrl: canvas.toDataURL('image/png')}, '*');
          return;
        }
        // For matplotlib: grab the rendered <img> elements
        var imgs = document.querySelectorAll('#plot img');
        if (imgs.length > 0) {
          window.parent.postMessage({type:'screenshot-result', dataUrl: imgs[0].src}, '*');
          return;
        }
        window.parent.postMessage({type:'screenshot-result', dataUrl: null}, '*');
      } catch(err) {
        window.parent.postMessage({type:'screenshot-result', dataUrl: null, error: err.toString()}, '*');
      }
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

      ${usesPlotly ? `
      userCode += \`
try:
    import plotly.io as _pio
    import plotly.graph_objects as _go
    from js import document, Plotly as _PlotlyJS
    # Find all plotly Figure objects in user scope and render them
    _all_vars = dict(globals())
    for _vname, _vobj in _all_vars.items():
        if _vname.startswith('_'):
            continue
        if isinstance(_vobj, _go.Figure):
            _div = document.createElement('div')
            _div.style.width = '100%'
            _div.style.marginTop = '12px'
            document.getElementById('plot').appendChild(_div)
            # Use plotly.js from CDN (already loaded) to render
            _fig_json = _pio.to_json(_vobj)
            import json as _json
            _fig_data = _json.loads(_fig_json)
            _PlotlyJS.newPlot(_div, _fig_data.get('data', []), _fig_data.get('layout', {}), {'responsive': True})
except Exception as _pe:
    pass
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

// ─── ESM import detection ───────────────────────────────

/** Well-known component names for auto-detection in module scope */
const COMPONENT_NAMES = [
  "App", "Main", "Component", "Page", "Home", "Demo", "Example",
  "Game", "Chart", "Dashboard", "Calculator", "Timer", "Editor",
  "Viewer", "Player", "Widget",
] as const;

/** React hooks that should be auto-imported if code uses them without importing react */
const REACT_HOOKS = [
  "useState", "useEffect", "useRef", "useMemo", "useCallback",
  "useReducer", "useContext", "useLayoutEffect", "useId",
  "useTransition", "useDeferredValue", "useSyncExternalStore",
] as const;

const REACT_APIS = [
  "createContext", "Fragment", "Suspense", "lazy", "memo",
  "forwardRef", "Children", "cloneElement", "createElement",
  "isValidElement", "StrictMode",
] as const;

/**
 * Detect bare-specifier imports from user code.
 * Matches: `import X from 'pkg'`, `import { X } from 'pkg'`, `import * as X from 'pkg'`, `import 'pkg'`
 * Ignores relative imports (`./`, `../`, `/`).
 */
function detectImports(code: string): Set<string> {
  const imports = new Set<string>();
  const regex = /import\s+(?:[\w{},*\s]+from\s+)?['"]([^'"./][^'"]*)['"]/g;
  let m;
  while ((m = regex.exec(code)) !== null) {
    imports.add(m[1]);
  }
  return imports;
}

/**
 * Resolve a package specifier to its esm.sh URL.
 * First checks the pre-mapped IMPORTMAP_PACKAGES, then falls back to auto-generated URL.
 */
function resolveEsmUrl(specifier: string): string {
  if (IMPORTMAP_PACKAGES[specifier]) return IMPORTMAP_PACKAGES[specifier];
  // Auto-generate esm.sh URL for unknown packages, pin react deps to avoid duplication
  return `${ESM_CDN_BASE}/${specifier}?deps=react@18,react-dom@18`;
}

/**
 * Given a set of raw import specifiers from user code, build the full import map entries.
 * Always includes react + react-dom. Expands scoped package prefixes where needed.
 */
function buildImportMap(userImports: Set<string>): Record<string, string> {
  const entries: Record<string, string> = {};

  // Always include react core
  const corePackages = ["react", "react/", "react-dom", "react-dom/", "react-dom/client", "react/jsx-runtime"];
  for (const pkg of corePackages) {
    entries[pkg] = resolveEsmUrl(pkg);
  }

  for (const specifier of userImports) {
    // Skip react/react-dom (already added above)
    if (specifier === "react" || specifier === "react-dom" || specifier.startsWith("react/") || specifier.startsWith("react-dom/")) {
      // Still add the exact specifier if it's a subpath like react-dom/client
      entries[specifier] = resolveEsmUrl(specifier);
      continue;
    }

    // Add exact specifier
    entries[specifier] = resolveEsmUrl(specifier);

    // For packages that might have subpath imports (e.g., `three/examples/...`),
    // add the trailing-slash entry if the base package has one in IMPORTMAP_PACKAGES
    const basePkg = specifier.includes("/") ? specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/") : specifier;
    if (basePkg !== specifier) {
      // User imported a subpath — make sure base package + trailing slash are mapped
      entries[basePkg] = resolveEsmUrl(basePkg);
      const slashKey = basePkg + "/";
      entries[slashKey] = resolveEsmUrl(slashKey);
    } else {
      // Check if this package has a trailing-slash entry in IMPORTMAP_PACKAGES
      const slashKey = specifier + "/";
      if (IMPORTMAP_PACKAGES[slashKey]) {
        entries[slashKey] = IMPORTMAP_PACKAGES[slashKey];
      }
    }
  }

  return entries;
}

/**
 * Check if user code already imports React (any form).
 * Returns true if code has `import ... from 'react'` or `import 'react'`.
 */
function hasReactImport(code: string): boolean {
  return /import\s+(?:[\w{},*\s]+from\s+)?['"]react['"]/.test(code);
}

/**
 * Detect which React hooks/APIs are used in code so we can auto-import only what's needed.
 */
function detectUsedReactApis(code: string): { hooks: string[]; apis: string[] } {
  const hooks = REACT_HOOKS.filter((h) => new RegExp(`\\b${h}\\b`).test(code));
  const apis = REACT_APIS.filter((a) => new RegExp(`\\b${a}\\b`).test(code));
  return { hooks, apis };
}

/**
 * Build auto-prepended React import if the user's code doesn't already import react.
 */
function buildReactImportLine(code: string): string {
  if (hasReactImport(code)) return "";

  const { hooks, apis } = detectUsedReactApis(code);
  const named = [...hooks, ...apis];

  if (named.length > 0) {
    return `import React, { ${named.join(", ")} } from 'react';\n`;
  }
  // Even if no named imports detected, import React for JSX
  return `import React from 'react';\n`;
}

/**
 * Check if user code has an `export default` — indicates intended root component.
 */
function getDefaultExportName(code: string): string | null {
  // `export default function Foo`
  const funcMatch = code.match(/export\s+default\s+function\s+(\w+)/);
  if (funcMatch) return funcMatch[1];

  // `export default class Foo`
  const classMatch = code.match(/export\s+default\s+class\s+(\w+)/);
  if (classMatch) return classMatch[1];

  // `export default Foo` (identifier reference)
  const idMatch = code.match(/export\s+default\s+([A-Z]\w*)\s*;?$/m);
  if (idMatch) return idMatch[1];

  return null;
}

/**
 * Strip `export default` keywords but keep the declaration.
 * ESM `export` in a Babel `data-type="module"` script works, but `export default`
 * creates issues with the auto-render footer. We convert to plain declarations.
 */
function normalizeExports(code: string): string {
  return code
    // `export default function Foo(` → `function Foo(`
    .replace(/^export\s+default\s+(?=function\s|class\s)/gm, "")
    // `export default Foo;` → `` (just a reference, component detected by name)
    .replace(/^export\s+default\s+(\w+);?\s*$/gm, "")
    // `export { Foo, Bar };` → remove
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, "")
    // `export function Foo` → `function Foo` (named export)
    .replace(/^export\s+(?=function\s|class\s|const\s|let\s|var\s)/gm, "");
}

/**
 * Build the component detection + render footer injected after user code.
 * Uses try/catch per known component name since ESM module scope doesn't pollute window.
 */
function buildRenderFooter(defaultExportName: string | null): string {
  // If we know the default export name, render it directly
  if (defaultExportName) {
    return `
;(async () => {
  const { createRoot } = await import('react-dom/client');
  const _React = await import('react');
  try {
    const _root = createRoot(document.getElementById('root'));
    _root.render(_React.createElement(${defaultExportName}));
    window.parent.postMessage({type:'preview-ready'}, '*');
  } catch(_e) {
    window.parent.postMessage({type:'preview-error', message: _e.stack || _e.toString()}, '*');
  }
})();`;
  }

  // Otherwise, scan known component names in module scope via try/catch
  const tryBlocks = COMPONENT_NAMES.map(
    (name) => `  try { if (typeof ${name} === 'function' || (typeof ${name} === 'object' && ${name} !== null)) _C = ${name}; } catch(_) {}`
  ).join("\n");

  return `
;(async () => {
  const { createRoot } = await import('react-dom/client');
  const _React = await import('react');
  let _C;
${tryBlocks}
  if (_C) {
    try {
      const _root = createRoot(document.getElementById('root'));
      _root.render(_React.createElement(_C));
      window.parent.postMessage({type:'preview-ready'}, '*');
    } catch(_e) {
      window.parent.postMessage({type:'preview-error', message: _e.stack || _e.toString()}, '*');
    }
  } else {
    window.parent.postMessage({type:'preview-error', message:'No component found. Export default or define one of: ${COMPONENT_NAMES.join(", ")}'}, '*');
  }
})();`;
}

// ─── Main preview HTML builder ───────────────────────────

export function buildPreviewHtml(code: string): string {
  let cleanCode = code.trim();
  const fenceMatch = cleanCode.match(/^```(?:tsx?|jsx?|javascript|typescript|html)?\n([\s\S]*?)```$/);
  if (fenceMatch) {
    cleanCode = fenceMatch[1].trim();
  }

  // Python code — run via Pyodide
  if (isPythonCode(code)) {
    return buildPythonHtml(code);
  }

  // Error reporter + screenshot handler — injected into any HTML
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

  // Screenshot capture via postMessage
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'capture-screenshot') return;
    try {
      // Try plotly first — export all plotly charts as high-res images
      if (typeof Plotly !== 'undefined') {
        var plots = document.querySelectorAll('.js-plotly-plot');
        if (plots.length > 0) {
          Plotly.toImage(plots[0], {format:'png', width:1200, height:800, scale:2})
            .then(function(url) {
              window.parent.postMessage({type:'screenshot-result', dataUrl: url}, '*');
            });
          return;
        }
      }
      // Fallback: capture canvas element
      var canvas = document.querySelector('canvas');
      if (canvas) {
        window.parent.postMessage({type:'screenshot-result', dataUrl: canvas.toDataURL('image/png')}, '*');
        return;
      }
      // Fallback: use html2canvas if available, or report that we need it
      window.parent.postMessage({type:'screenshot-result', dataUrl: null, needsHtml2canvas: true}, '*');
    } catch(err) {
      window.parent.postMessage({type:'screenshot-result', dataUrl: null, error: err.toString()}, '*');
    }
  });
})();
<\/script>`;

  const readySignal = `<script>window.parent.postMessage({type:'preview-ready'}, '*');<\/script>`;

  // Full HTML document — inject error reporter (unchanged)
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

  // ─── React/JSX code — import maps + esm.sh ─────────────

  // 1. Detect the default export name before normalizing
  const defaultExportName = getDefaultExportName(cleanCode);

  // 2. Detect all bare-specifier imports from user code
  const userImports = detectImports(cleanCode);

  // 3. Build the import map with all required packages
  const importMapEntries = buildImportMap(userImports);
  const importMapJson = JSON.stringify({ imports: importMapEntries }, null, 2);

  // 4. Auto-prepend React import if missing
  const reactImportLine = buildReactImportLine(cleanCode);

  // 5. Normalize exports (strip export keywords, keep declarations)
  const normalizedCode = normalizeExports(cleanCode);

  // 6. Build the render footer
  const renderFooter = buildRenderFooter(defaultExportName);

  // Combine user code with auto-imports and render footer
  const fullCode = `${reactImportLine}${normalizedCode}\n\n${renderFooter}`;
  // Escape for embedding in a JS string literal (backtick template)
  const escapedCode = fullCode
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script type="importmap">${importMapJson}<\/script>
  <script src="${TAILWIND_CDN_URL}"><\/script>
  <script src="${BABEL_CDN_URL}"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #root { min-height: 100vh; }
  </style>
  ${errorReporter}
</head>
<body>
  <div id="root"></div>
  <script>
  // Babel transforms JSX, then we inject as native <script type="module">
  // so the browser's import map resolves bare specifiers (three, recharts, etc.)
  try {
    var _code = \`${escapedCode}\`;
    var _transformed = Babel.transform(_code, {
      presets: ['react'],
      sourceType: 'module',
      filename: 'artifact.tsx',
    }).code;
    var _script = document.createElement('script');
    _script.type = 'module';
    _script.textContent = _transformed;
    document.head.appendChild(_script);
  } catch(_e) {
    window.parent.postMessage({type:'preview-error', message: 'Babel: ' + (_e.message || _e.toString())}, '*');
  }
  <\/script>
</body>
</html>`;
}
