"use client";

import { openArticleInPanel } from "@/lib/panel-actions";

const CODE_LABELS: Record<string, string> = {
  constitution: "Конституция РК",
  criminal_code: "УК РК",
  criminal_procedure: "УПК РК",
  civil_code_general: "ГК РК (Общая часть)",
  civil_code_special: "ГК РК (Особенная часть)",
  civil_procedure: "ГПК РК",
  admin_offenses: "КоАП РК",
  admin_procedure: "АППК РК",
  tax_code: "НК РК",
  labor_code: "ТК РК",
  land_code: "ЗК РК",
  ecological_code: "ЭК РК",
  entrepreneurship: "ПК РК",
  budget_code: "БК РК",
  customs_code: "ТамК РК",
  family_code: "КоБС РК",
  social_code: "СК РК",
  water_code: "ВК РК",
};

interface ArticleLinkProps {
  code: string;
  article: string;
  children?: React.ReactNode;
}

export function ArticleLink({ code, article, children }: ArticleLinkProps) {
  const label = children || `ст. ${article} ${CODE_LABELS[code] || code}`;

  return (
    <button
      type="button"
      onClick={() => openArticleInPanel(code, article)}
      className="text-legal-ref hover:text-legal-ref-hover underline decoration-legal-ref/40 hover:decoration-legal-ref cursor-pointer inline-flex items-center gap-0.5 transition-colors"
    >
      <span className="text-[0.85em] leading-none">&sect;</span>
      {label}
    </button>
  );
}
