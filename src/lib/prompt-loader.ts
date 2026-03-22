import fs from "node:fs";
import path from "node:path";

// ─── In-memory cache: file read only once per process ────────

const fileCache = new Map<string, string>();

const PROMPTS_DIR = path.join(process.cwd(), "src", "prompts");

/**
 * Load a prompt template from `src/prompts/{name}.txt`.
 * Uses an in-memory Map cache so each file is read at most once per process.
 */
export function loadPrompt(name: string): string {
  const cached = fileCache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  const filePath = path.join(PROMPTS_DIR, `${name}.txt`);
  const content = fs.readFileSync(filePath, "utf-8");
  fileCache.set(name, content);
  return content;
}

/**
 * Clear the file cache. Useful in tests.
 */
export function clearPromptFileCache(): void {
  fileCache.clear();
}
