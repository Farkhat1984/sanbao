export const APP_NAME = "Leema";
export const APP_DESCRIPTION = "Юридический AI-ассистент";

export const LEGAL_TOOL_NAMES = {
  createContract: "createContract",
  createClaim: "createClaim",
  createComplaint: "createComplaint",
  analyzeNpa: "analyzeNpa",
  checkActuality: "checkActuality",
  searchArticles: "searchArticles",
} as const;

export const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Договор",
  CLAIM: "Исковое заявление",
  COMPLAINT: "Жалоба",
  DOCUMENT: "Документ",
  CODE: "Код",
  ANALYSIS: "Правовой анализ",
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
];
