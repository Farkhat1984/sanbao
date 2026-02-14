export type ExportFormat = "docx" | "pdf" | "txt";

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
