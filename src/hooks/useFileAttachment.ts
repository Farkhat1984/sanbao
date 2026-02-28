"use client";

import { useState, useRef, useCallback } from "react";
import { MAX_FILE_SIZE_PARSE } from "@/lib/constants";

// ─── Constants ──────────────────────────────────────────

const CHAT_ACCEPTED_EXTENSIONS =
  ".png,.jpg,.jpeg,.webp,.txt,.md,.pdf,.docx,.doc,.xlsx,.xls,.csv,.html,.htm,.pptx,.rtf";
const CHAT_MAX_FILE_SIZE = MAX_FILE_SIZE_PARSE;

// ─── Types ──────────────────────────────────────────────

export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  base64?: string;
  preview?: string;
  textContent?: string;
  isParsing?: boolean;
}

// ─── Document type helpers ──────────────────────────────

const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "text/html",
];

const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".pptx", ".rtf", ".html", ".htm"];

function isDocumentFile(file: File): boolean {
  if (DOCUMENT_TYPES.includes(file.type)) return true;
  return DOCUMENT_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );
}

// ─── File reading helpers ───────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ─── Hook ───────────────────────────────────────────────

export interface UseFileAttachmentReturn {
  files: AttachedFile[];
  addFiles: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  alertMessage: { title: string; description?: string } | null;
  setAlertMessage: (msg: { title: string; description?: string } | null) => void;
  acceptedExtensions: string;
}

export function useFileAttachment(): UseFileAttachmentReturn {
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [alertMessage, setAlertMessage] = useState<{ title: string; description?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (!selectedFiles) return;

      for (const file of Array.from(selectedFiles)) {
        if (file.size > CHAT_MAX_FILE_SIZE) {
          setAlertMessage({ title: "Файл слишком большой", description: `«${file.name}» превышает лимит 20 МБ` });
          continue;
        }

        const isImage = file.type.startsWith("image/");
        const isText =
          file.type === "text/plain" || file.type === "text/csv" ||
          file.name.endsWith(".md") || file.name.endsWith(".csv");
        const isDocument = isDocumentFile(file);

        if (!isImage && !isText && !isDocument) {
          setAlertMessage({ title: "Формат не поддерживается", description: `«${file.name}» — поддерживаются PNG, JPG, WebP, TXT, MD, CSV, PDF, DOCX, XLSX, PPTX, RTF, HTML` });
          continue;
        }

        const attached: AttachedFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type || (file.name.endsWith(".md") ? "text/plain" : file.name.endsWith(".csv") ? "text/csv" : ""),
          size: file.size,
        };

        if (isImage) {
          const dataUrl = await readFileAsDataUrl(file);
          attached.preview = dataUrl;
          attached.base64 = dataUrl.split(",")[1];
          setFiles((prev) => [...prev, attached]);
        } else if (isText) {
          attached.textContent = await readFileAsText(file);
          setFiles((prev) => [...prev, attached]);
        } else if (isDocument) {
          // Parse document server-side
          attached.isParsing = true;
          setFiles((prev) => [...prev, attached]);

          try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/files/parse", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              const err = await response.json().catch(() => ({ error: "Ошибка" }));
              throw new Error(err.error || "Не удалось обработать файл");
            }

            const { text } = await response.json();
            setFiles((prev) =>
              prev.map((f) =>
                f.id === attached.id
                  ? { ...f, textContent: text, isParsing: false }
                  : f
              )
            );
          } catch (err) {
            setAlertMessage({ title: "Ошибка обработки файла", description: `«${file.name}»: ${err instanceof Error ? err.message : "Неизвестная ошибка"}` });
            setFiles((prev) => prev.filter((f) => f.id !== attached.id));
          }
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    []
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    fileInputRef,
    cameraInputRef,
    alertMessage,
    setAlertMessage,
    acceptedExtensions: CHAT_ACCEPTED_EXTENSIONS,
  };
}
