"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";
import type { Integration } from "@/types/integration";
import { StepTypeSelector } from "./StepTypeSelector";
import { StepConfigForm } from "./StepConfigForm";
import { StepTestConnection } from "./StepTestConnection";
import { StepQrCode } from "./StepQrCode";
import { StepDone } from "./StepDone";

interface IntegrationFormProps {
  integration?: Integration;
}

type Step = "type" | "config" | "test" | "qr" | "done";

const ODATA_STEPS: Step[] = ["type", "config", "test", "done"];
const WHATSAPP_STEPS: Step[] = ["type", "config", "qr", "done"];

function getSteps(type: string): Step[] {
  return type === "WHATSAPP" ? WHATSAPP_STEPS : ODATA_STEPS;
}

export function IntegrationForm({ integration }: IntegrationFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
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

  const isWhatsApp = type === "WHATSAPP";
  const steps = getSteps(type);

  const handleSave = async () => {
    if (isWhatsApp) {
      if (!name.trim()) {
        setError(t("integration.fillRequired"));
        return;
      }
    } else {
      if (!name.trim() || !baseUrl.trim() || (!isEdit && (!username.trim() || !password.trim()))) {
        setError(t("integration.fillRequired"));
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const url = isEdit ? `/api/integrations/${integration.id}` : "/api/integrations";
      const body: Record<string, string> = { name };

      if (isWhatsApp) {
        if (!isEdit) body.type = "WHATSAPP";
      } else {
        body.baseUrl = baseUrl;
        if (!isEdit) body.type = type;
        if (username) body.username = username;
        if (password) body.password = password;
      }

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("integration.saveError"));
      }

      const data = await res.json();
      setCreatedId(data.id);
      setStep(isWhatsApp ? "qr" : "test");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("integration.saveError"));
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
      setTestResult({ success: false, error: t("integration.connectionError") });
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
        throw new Error(data.error || t("integration.discoveryError"));
      }
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("integration.discoveryError"));
    } finally {
      setDiscovering(false);
    }
  };

  const handleTypeSelect = (selectedType: string) => {
    setType(selectedType);
    setStep("config");
  };

  const navigateToIntegrations = () => router.push("/integrations");
  const navigateToAgents = () => router.push("/agents");

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <button
        onClick={navigateToIntegrations}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("integration.backToIntegrations")}
      </button>

      <h1 className="text-xl font-bold text-text-primary mb-6 font-[family-name:var(--font-display)]">
        {isEdit ? t("integration.editTitle") : t("integration.title")}
      </h1>

      {/* Step indicator */}
      {!isEdit && steps.length > 0 && (
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full transition-colors ${
                step === s ? "bg-accent" :
                (steps.indexOf(step) > i ? "bg-accent/50" : "bg-border")
              }`} />
              {i < steps.length - 1 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>
      )}

      {step === "type" && (
        <StepTypeSelector onSelect={handleTypeSelect} />
      )}

      {step === "config" && (
        <StepConfigForm
          isEdit={isEdit}
          type={type}
          name={name}
          baseUrl={baseUrl}
          username={username}
          password={password}
          saving={saving}
          error={error}
          onNameChange={setName}
          onBaseUrlChange={setBaseUrl}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onSave={handleSave}
          onBack={() => setStep("type")}
        />
      )}

      {step === "test" && (
        <StepTestConnection
          testing={testing}
          discovering={discovering}
          testResult={testResult}
          error={error}
          onTest={handleTest}
          onDiscover={handleDiscover}
          onSkip={navigateToIntegrations}
        />
      )}

      {step === "qr" && createdId && (
        <StepQrCode
          integrationId={createdId}
          onConnected={() => setStep("done")}
          onBack={() => setStep("config")}
        />
      )}

      {step === "done" && (
        <StepDone
          onGoToIntegrations={navigateToIntegrations}
          onGoToAgents={navigateToAgents}
          description={isWhatsApp ? t("integration.whatsappDoneDescription") : undefined}
        />
      )}
    </div>
  );
}
