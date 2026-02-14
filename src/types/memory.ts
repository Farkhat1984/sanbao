export interface UserMemory {
  id: string;
  key: string;
  content: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MEMORY_KEYS = {
  citation_style: "Стиль цитирования",
  jurisdiction: "Юрисдикция",
  frequent_articles: "Частые статьи НПА",
  corporate_standards: "Корпоративные стандарты",
  language_preference: "Языковые предпочтения",
  document_format: "Формат документов",
} as const;

export type MemoryKey = keyof typeof MEMORY_KEYS;
