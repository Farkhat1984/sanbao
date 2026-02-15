export type ExportFormat = "docx" | "pdf" | "txt" | "xlsx" | "html" | "md";

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function exportAsText(content: string, title: string, ext: string = ".txt"): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(title)}${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Markdown → HTML converter ────────────────────────────

function markdownToHtmlString(md: string): string {
  let html = md;

  // Headings (must run before inline bold)
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "<hr>");

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Tables
  html = html.replace(
    /^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm,
    (_match, headerLine: string, _sep: string, bodyBlock: string) => {
      const headers = headerLine
        .split("|")
        .map((c: string) => c.trim())
        .filter(Boolean);
      const headerHtml = headers.map((h: string) => `<th>${h}</th>`).join("");

      const rows = bodyBlock.trim().split("\n");
      const bodyHtml = rows
        .map((row: string) => {
          const cells = row
            .split("|")
            .map((c: string) => c.trim())
            .filter(Boolean);
          return `<tr>${cells.map((c: string) => `<td>${c}</td>`).join("")}</tr>`;
        })
        .join("\n");

      return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
    }
  );

  // Unordered lists
  html = html.replace(
    /^([-*+] .+(?:\n[-*+] .+)*)/gm,
    (block) => {
      const items = block
        .split("\n")
        .map((l) => l.replace(/^[-*+]\s+/, ""))
        .map((l) => `<li>${l}</li>`)
        .join("\n");
      return `<ul>${items}</ul>`;
    }
  );

  // Ordered lists
  html = html.replace(
    /^(\d+[.)]\s+.+(?:\n\d+[.)]\s+.+)*)/gm,
    (block) => {
      const items = block
        .split("\n")
        .map((l) => l.replace(/^\d+[.)]\s+/, ""))
        .map((l) => `<li>${l}</li>`)
        .join("\n");
      return `<ol>${items}</ol>`;
    }
  );

  // Code blocks
  html = html.replace(/```[\s\S]*?\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs: wrap remaining non-empty lines not already in tags
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|table|pre|hr|blockquote)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}

// ─── HTML export ──────────────────────────────────────────

export function exportAsHtml(content: string, title: string): void {
  const bodyHtml = markdownToHtmlString(content);
  const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>
<style>
  body { max-width: 210mm; margin: 20mm auto; padding: 0 15mm; font-family: "Times New Roman", serif; font-size: 14px; line-height: 1.6; color: #1a1a1a; }
  h1 { text-align: center; font-size: 1.8em; text-transform: uppercase; margin: 1.5em 0 0.8em; }
  h2 { font-size: 1.4em; margin: 1.2em 0 0.6em; }
  h3 { font-size: 1.2em; margin: 1em 0 0.5em; }
  p { text-align: justify; text-indent: 1.25cm; margin: 0.3em 0; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #e8ebf0; font-weight: bold; }
  ul, ol { margin: 0.5em 0; padding-left: 2em; }
  li { margin: 0.2em 0; }
  pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow-x: auto; }
  code { font-family: monospace; font-size: 0.9em; }
  hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
  a { color: #4F6EF7; text-decoration: none; }
  @media print { body { margin: 0; padding: 15mm 20mm; max-width: none; } }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(title)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Markdown export ──────────────────────────────────────

export function exportAsMarkdown(content: string, title: string): void {
  exportAsText(content, title, ".md");
}
