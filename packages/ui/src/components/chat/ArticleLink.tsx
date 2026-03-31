"use client";

import { openArticleInPanel } from "@/lib/panel-actions";
import { useLinkRegistry } from "@/hooks/useLinkRegistry";

/** Fallback labels used before registry loads (instant render, no flash). */
const FALLBACK_LABELS: Record<string, string> = {
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
  housing_code: "ЖК РК",
  social_code: "СК РК",
  water_code: "ВК РК",
  law: "Закон РК",
  "1c": "1С",
  "1c_buh": "1С Бухгалтерия",
  tnved: "ТН ВЭД",
};

interface ArticleLinkProps {
  code: string;
  article: string;
  children?: React.ReactNode;
}

export function ArticleLink({ code, article, children }: ArticleLinkProps) {
  const { registry, getLabel, getIcon } = useLinkRegistry();

  const iconType = Object.keys(registry).length > 0
    ? getIcon(code)
    : "legal";

  const codeLabel = Object.keys(registry).length > 0
    ? getLabel(code)
    : (FALLBACK_LABELS[code] || code);

  const isLegal = iconType === "legal";
  const isDoc = iconType === "doc";

  let label: React.ReactNode = children;
  if (!label) {
    if (isLegal && code !== "law") {
      label = `ст. ${article} ${codeLabel}`;
    } else if (code === "law") {
      label = `${codeLabel} ${article}`;
    } else if (isDoc) {
      label = children || article;
    } else {
      label = `${article} ${codeLabel}`;
    }
  }

  const icon = isDoc ? "📖" : iconType === "customs" ? "📦" : "§";

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
