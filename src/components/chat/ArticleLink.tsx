"use client";

import { useArticleStore } from "@/stores/articleStore";

const CODE_LABELS: Record<string, string> = {
  criminal_code: "УК РК",
  civil_code: "ГК РК",
  administrative_code: "КоАП РК",
  tax_code: "НК РК",
  labor_code: "ТК РК",
  land_code: "ЗК РК",
  environmental_code: "ЭК РК",
  business_code: "ПК РК",
  civil_procedure_code: "ГПК РК",
  criminal_procedure_code: "УПК РК",
};

interface ArticleLinkProps {
  code: string;
  article: string;
  children?: React.ReactNode;
}

export function ArticleLink({ code, article, children }: ArticleLinkProps) {
  const openArticle = useArticleStore((s) => s.openArticle);

  const label = children || `ст. ${article} ${CODE_LABELS[code] || code}`;

  return (
    <button
      type="button"
      onClick={() => openArticle(code, article)}
      className="text-legal-ref hover:text-legal-ref-hover underline decoration-legal-ref/40 hover:decoration-legal-ref cursor-pointer inline-flex items-center gap-0.5 transition-colors"
    >
      <span className="text-[0.85em] leading-none">§</span>
      {label}
    </button>
  );
}
