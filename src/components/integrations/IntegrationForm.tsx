"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Database, AlertCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { INTEGRATION_TYPES } from "@/lib/constants";
import type { Integration } from "@/types/integration";

interface IntegrationFormProps {
  integration?: Integration;
}

type Step = "type" | "config" | "test" | "done";

export function IntegrationForm({ integration }: IntegrationFormProps) {
  const router = useRouter();
  const isEdit = !!integration;

  const [step, setStep] = useState<Step>(isEdit ? "config" : "type");
  const [type, setType] = useState(integration?.type || "");
  const [name, setName] = useState(integration?.name || "");
  const [baseUrl, setBaseUrl] = useState(integration?.baseUrl || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(integration?.id || null);

  const handleSave = async () => {
    if (!name.trim() || !baseUrl.trim() || (!isEdit && (!username.trim() || !password.trim()))) {
      setError("Заполните все обязательные поля");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = isEdit ? `/api/integrations/${integration.id}` : "/api/integrations";
      const body: Record<string, string> = { name, baseUrl };
      if (!isEdit) body.type = type;
      if (username) body.username = username;
      if (password) body.password = password;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка сохранения");
      }

      const data = await res.json();
      setCreatedId(data.id);
      setStep("test");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!createdId) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`/api/integrations/${createdId}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Ошибка соединения" });
    } finally {
      setTesting(false);
    }
  };

  const handleDiscover = async () => {
    if (!createdId) return;
    setDiscovering(true);
    setError(null);

    try {
      const res = await fetch(`/api/integrations/${createdId}/discover`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка обнаружения");
      }
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка обнаружения");
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <button
        onClick={() => router.push("/integrations")}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к интеграциям
      </button>

      <h1 className="text-xl font-bold text-text-primary mb-6 font-[family-name:var(--font-display)]">
        {isEdit ? "Редактировать интеграцию" : "Новая интеграция"}
      </h1>

      {/* Step indicator */}
      {!isEdit && (
        <div className="flex items-center gap-2 mb-8">
          {(["type", "config", "test", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full transition-colors ${
                step === s ? "bg-accent" :
                (["type", "config", "test", "done"].indexOf(step) > i ? "bg-accent/50" : "bg-border")
              }`} />
              {i < 3 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>
      )}

      {/* Step: Type Selection */}
      {step === "type" && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary mb-4">Выберите тип интеграции</p>
          {INTEGRATION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setType(t.value); setStep("config"); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-surface hover:border-accent transition-all cursor-pointer text-left"
            >
              <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Database className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{t.label}</h3>
                <p className="text-xs text-text-secondary mt-0.5">OData API для обмена данными с 1С:Предприятие</p>
              </div>
              <ArrowRight className="h-4 w-4 text-text-secondary ml-auto" />
            </button>
          ))}
        </div>
      )}

      {/* Step: Config */}
      {step === "config" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-5">
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                Название <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: 1С Бухгалтерия"
                maxLength={200}
                className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                URL OData API <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://server:port/base/odata/standard.odata/"
                className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors font-mono text-xs"
              />
              <p className="text-xs text-text-secondary mt-1">
                Полный URL до корня OData-сервиса 1С
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">
                  Логин {!isEdit && <span className="text-error">*</span>}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Имя пользователя"
                  className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">
                  Пароль {!isEdit && <span className="text-error">*</span>}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-4 rounded-xl bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
            {isEdit && (
              <p className="text-xs text-text-secondary">
                Оставьте логин и пароль пустыми, если не хотите менять учётные данные
              </p>
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
                onClick={() => setStep("type")}
                className="h-10 px-4 rounded-xl border border-border bg-surface text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                Назад
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim() || !baseUrl.trim()}
              className="h-10 px-6 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {isEdit ? "Сохранить" : "Далее"}
            </button>
          </div>
        </div>
      )}

      {/* Step: Test */}
      {step === "test" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <Database className="h-10 w-10 text-accent mx-auto mb-3" />
            <h2 className="text-sm font-semibold text-text-primary mb-1">Проверка подключения</h2>
            <p className="text-xs text-text-secondary mb-5">
              Проверим доступность 1С и корректность учётных данных
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
                    {testResult.success ? "Подключение успешно" : testResult.error || "Ошибка подключения"}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleTest}
              disabled={testing}
              className="h-10 px-6 rounded-xl border border-border bg-surface text-sm font-medium text-text-primary hover:bg-surface-alt transition-colors flex items-center gap-2 mx-auto cursor-pointer disabled:opacity-60"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {testing ? "Проверка..." : "Проверить"}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-error/10 border border-error/20">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleDiscover}
              disabled={discovering}
              className="h-10 px-6 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
            >
              {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {discovering ? "Обнаружение..." : "Обнаружить сущности"}
            </button>
            <button
              onClick={() => router.push("/integrations")}
              className="h-10 px-4 rounded-xl border border-border bg-surface text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Пропустить
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
            <Check className="h-7 w-7 text-success" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Интеграция подключена</h2>
          <p className="text-sm text-text-secondary mb-6">
            Сущности обнаружены. Теперь вы можете подключить эту интеграцию к агенту.
          </p>
          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={() => router.push("/integrations")}
              className="h-10 px-6 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-all cursor-pointer"
            >
              К интеграциям
            </button>
            <button
              onClick={() => router.push("/agents")}
              className="h-10 px-4 rounded-xl border border-border bg-surface text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              К агентам
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
