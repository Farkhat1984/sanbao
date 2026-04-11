import { ArrowRight, Database, MessageCircle, Send } from "lucide-react";
import { INTEGRATION_TYPES } from "@/lib/constants";
import { useTranslation } from "@/hooks/useTranslation";
import type { ElementType } from "react";

const ICON_MAP: Record<string, ElementType> = {
  Database,
  MessageCircle,
  Send,
};

const DESCRIPTION_KEYS: Record<string, string> = {
  ODATA_1C: "integration.odataDescription",
  WHATSAPP: "integration.whatsappDescription",
  TELEGRAM: "integration.telegramDescription",
};

interface StepTypeSelectorProps {
  onSelect: (type: string) => void;
}

export function StepTypeSelector({ onSelect }: StepTypeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary mb-4">{t("integration.selectType")}</p>
      {INTEGRATION_TYPES.map((integrationType) => {
        const Icon = ICON_MAP[integrationType.icon] || Database;
        return (
          <button
            key={integrationType.value}
            type="button"
            onClick={() => onSelect(integrationType.value)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-surface hover:border-accent transition-all cursor-pointer text-left"
          >
            <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{integrationType.label}</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {t(DESCRIPTION_KEYS[integrationType.value] || "integration.odataDescription")}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-text-secondary ml-auto" />
          </button>
        );
      })}
    </div>
  );
}
