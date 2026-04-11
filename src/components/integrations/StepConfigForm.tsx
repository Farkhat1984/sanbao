import { ArrowRight, Loader2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface StepConfigFormProps {
  isEdit: boolean;
  type: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  botToken?: string;
  saving: boolean;
  error: string | null;
  onNameChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onBotTokenChange?: (value: string) => void;
  onSave: () => void;
  onBack: () => void;
}

export function StepConfigForm({
  isEdit,
  type,
  name,
  baseUrl,
  username,
  password,
  botToken,
  saving,
  error,
  onNameChange,
  onBaseUrlChange,
  onUsernameChange,
  onPasswordChange,
  onBotTokenChange,
  onSave,
  onBack,
}: StepConfigFormProps) {
  const { t } = useTranslation();
  const isWhatsApp = type === "WHATSAPP";
  const isTelegram = type === "TELEGRAM";

  const isValid = isWhatsApp
    ? !!name.trim()
    : isTelegram
      ? !!name.trim() && !!(botToken?.trim())
      : !!name.trim() && !!baseUrl.trim();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-5">
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">
            {t("integration.name")} <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={
              isWhatsApp ? t("integration.whatsappNamePlaceholder") :
              isTelegram ? t("integration.telegramNamePlaceholder") :
              t("integration.namePlaceholder")
            }
            maxLength={200}
            className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {isTelegram && (
          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">
              {t("integration.botToken")} <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={botToken || ""}
              onChange={(e) => onBotTokenChange?.(e.target.value)}
              placeholder={t("integration.botTokenPlaceholder")}
              className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors font-mono text-xs"
            />
            <p className="text-xs text-text-secondary mt-1">
              {t("integration.botTokenHint")}
            </p>
          </div>
        )}

        {!isWhatsApp && !isTelegram && (
          <>
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                {t("integration.url")} <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => onBaseUrlChange(e.target.value)}
                placeholder={t("integration.urlPlaceholder")}
                className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors font-mono text-xs"
              />
              <p className="text-xs text-text-secondary mt-1">
                {t("integration.urlHint")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">
                  {t("integration.login")} {!isEdit && <span className="text-error">*</span>}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  placeholder={t("integration.loginPlaceholder")}
                  className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">
                  {t("integration.password")} {!isEdit && <span className="text-error">*</span>}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
            {isEdit && (
              <p className="text-xs text-text-secondary">
                {t("integration.credentialsHint")}
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-error/10 border border-error/20">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        {!isEdit && (
          <button
            type="button"
            onClick={onBack}
            className="h-10 px-4 rounded-xl border border-border bg-surface text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            {t("common.back")}
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !isValid}
          className="h-10 px-6 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {isEdit ? t("common.save") : t("common.next")}
        </button>
      </div>
    </div>
  );
}
