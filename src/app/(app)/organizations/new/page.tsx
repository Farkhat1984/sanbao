"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { useOrgStore } from "@/stores/orgStore";

export default function NewOrganizationPage() {
  const router = useRouter();
  const { addOrganization } = useOrgStore();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка создания");
        return;
      }

      addOrganization(data);
      router.push(`/organizations/${data.id}`);
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-accent/20 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">Новая организация</h1>
            <p className="text-sm text-text-secondary">Создайте организацию для вашей команды</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-2">
              Название организации
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Моя компания"
              maxLength={200}
              required
              className="w-full h-11 px-4 rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-error-light text-error text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="w-full h-11 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium flex items-center justify-center gap-2 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? "Создание..." : "Создать организацию"}
          </button>
        </form>
      </div>
    </div>
  );
}
