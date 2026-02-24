"use client";

import { openArticleInPanel } from "@/lib/panel-actions";

const CODE_LABELS: Record<string, string> = {
  // 18 кодексов РК
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
  // Законы и НПА
  law: "Закон РК",
  // 1С
  "1c": "1С",
  "1c_buh": "1С Бухгалтерия",
};

/** Codes that use "ст. N" prefix (legal codes) */
const LEGAL_CODES = new Set([
  "constitution", "criminal_code", "criminal_procedure",
  "civil_code_general", "civil_code_special", "civil_procedure",
  "admin_offenses", "admin_procedure", "tax_code",
  "labor_code", "land_code", "ecological_code",
  "entrepreneurship", "budget_code", "customs_code",
  "family_code", "social_code", "water_code",
]);

interface ArticleLinkProps {
  code: string;
  article: string;
  children?: React.ReactNode;
}

export function ArticleLink({ code, article, children }: ArticleLinkProps) {
  const isLegal = LEGAL_CODES.has(code);
  const isLaw = code === "law";
  const is1c = code === "1c" || code === "1c_buh";

  let label: React.ReactNode = children;
  if (!label) {
    if (isLegal) {
      label = `ст. ${article} ${CODE_LABELS[code] || code}`;
    } else if (isLaw) {
      label = `${CODE_LABELS[code]} ${article}`;
    } else if (is1c) {
      label = children || article;
    } else {
      label = `${article} ${CODE_LABELS[code] || code}`;
    }
  }

  const icon = is1c ? "📖" : "§";

  return (
    <button
      type="button"
      onClick={() => openArticleInPanel(code, article)}
      className="text-legal-ref hover:text-legal-ref-hover underline decoration-legal-ref/40 hover:decoration-legal-ref cursor-pointer inline-flex items-center gap-0.5 transition-colors"
    >
      <span className="text-[0.85em] leading-none">{icon}</span>
      {label}
    </button>
  );
}
