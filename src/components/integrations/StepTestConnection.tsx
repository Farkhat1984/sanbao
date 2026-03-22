import { AlertCircle, Check, Database, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface StepTestConnectionProps {
  testing: boolean;
  discovering: boolean;
  testResult: { success: boolean; error?: string } | null;
  error: string | null;
  onTest: () => void;
  onDiscover: () => void;
  onSkip: () => void;
}

export function StepTestConnection({
  testing,
  discovering,
  testResult,
  error,
  onTest,
  onDiscover,
  onSkip,
}: StepTestConnectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <Database className="h-10 w-10 text-accent mx-auto mb-3" />
        <h2 className="text-sm font-semibold text-text-primary mb-1">{t("integration.testConnection")}</h2>
        <p className="text-xs text-text-secondary mb-5">
          {t("integration.testDescription")}
        </p>

        {testResult && (
          <div className={`p-3 rounded-xl mb-4 ${testResult.success ? "bg-success/10 border border-success/20" : "bg-error/10 border border-error/20"}`}>
            <div className="flex items-center gap-2 justify-center">
              {testResult.success ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-error" />
              )}
              <p className={`text-sm ${testResult.success ? "text-success" : "text-error"}`}>
                {testResult.success ? t("integration.testSuccess") : testResult.error || t("integration.testError")}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={onTest}
          disabled={testing}
          className="h-10 px-6 rounded-xl border border-border bg-surface text-sm font-medium text-text-primary hover:bg-surface-alt transition-colors flex items-center gap-2 mx-auto cursor-pointer disabled:opacity-60"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {testing ? t("integration.testing") : t("integration.test")}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-error/10 border border-error/20">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onDiscover}
          disabled={discovering}
          className="h-10 px-6 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
        >
          {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {discovering ? t("integration.discovering") : t("integration.discover")}
        </button>
        <button
          onClick={onSkip}
          className="h-10 px-4 rounded-xl border border-border bg-surface text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          {t("common.skip")}
        </button>
      </div>
    </div>
  );
}
