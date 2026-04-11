import { Check } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface StepDoneProps {
  onGoToIntegrations: () => void;
  onGoToAgents: () => void;
  description?: string;
}

export function StepDone({ onGoToIntegrations, onGoToAgents, description }: StepDoneProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <div className="h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
        <Check className="h-7 w-7 text-success" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">{t("integration.doneTitle")}</h2>
      <p className="text-sm text-text-secondary mb-6">
        {description || t("integration.doneDescription")}
      </p>
      <div className="flex items-center gap-3 justify-center">
        <button
          onClick={onGoToIntegrations}
          className="h-10 px-6 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-all cursor-pointer"
        >
          {t("integration.goToIntegrations")}
        </button>
        <button
          onClick={onGoToAgents}
          className="h-10 px-4 rounded-xl border border-border bg-surface text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          {t("integration.goToAgents")}
        </button>
      </div>
    </div>
  );
}
