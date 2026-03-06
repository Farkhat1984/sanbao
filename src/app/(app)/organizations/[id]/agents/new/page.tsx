"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Upload } from "lucide-react";
import { FileUploader } from "@/components/organizations/FileUploader";

type Step = "info" | "upload";

export default function NewOrgAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { id } = await params;
      const res = await fetch(`/api/organizations/${id}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка создания");
        return;
      }

      setAgentId(data.id);
      setStep("upload");
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadComplete = async () => {
    const { id } = await params;
    router.push(`/organizations/${id}/agents/${agentId}`);
  };

  return (
    <div className="h-full">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={async () => {
            const { id } = await params;
            router.push(`/organizations/${id}/agents`);
          }}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-accent/20 to-legal-ref/20 flex items-center justify-center">
            {step === "info" ? (
              <Bot className="h-6 w-6 text-accent" />
            ) : (
              <Upload className="h-6 w-6 text-accent" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {step === "info" ? "Новый агент" : "Загрузка файлов"}
            </h1>
            <p className="text-sm text-text-muted">
              {step === "info"
                ? "Шаг 1: Информация об агенте"
                : "Шаг 2: Загрузите документы для обучения"}
            </p>
          </div>
        </div>

        {step === "info" && (
          <form onSubmit={handleCreateAgent} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-2">
                Название агента
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Юрист по договорам"
                maxLength={200}
                required
                className="w-full h-11 px-4 rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="desc" className="block text-sm font-medium text-text-primary mb-2">
                Описание (необязательно)
              </label>
              <textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Агент для анализа и консультирования по договорам"
                maxLength={2000}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-accent to-legal-ref text-white font-medium flex items-center justify-center gap-2 hover:shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Создание..." : "Далее: загрузить файлы"}
            </button>
          </form>
        )}

        {step === "upload" && agentId && (
          <FileUploader
            params={params}
            agentId={agentId}
            onComplete={handleUploadComplete}
          />
        )}
      </div>
    </div>
  );
}
