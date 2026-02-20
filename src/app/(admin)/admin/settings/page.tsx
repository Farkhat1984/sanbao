"use client";

import { useState, useEffect, useRef } from "react";
import { Save, Upload, Trash2, Image } from "lucide-react";
import { Button } from "@/components/ui/Button";

const SETTING_FIELDS = [
  { key: "app_name", label: "Название приложения", placeholder: "Sanbao" },
  { key: "system_prompt_global", label: "Глобальный системный промпт", placeholder: "Ты — AI-ассистент...", multiline: true },
  { key: "max_upload_size_mb", label: "Макс. размер файла (МБ)", placeholder: "10" },
  { key: "max_file_count", label: "Макс. количество файлов", placeholder: "5" },
  { key: "registration_enabled", label: "Регистрация открыта", type: "toggle" },
  { key: "google_oauth_enabled", label: "Google OAuth", type: "toggle" },
  { key: "maintenance_mode", label: "Режим обслуживания", type: "toggle" },
  { key: "default_language", label: "Язык по умолчанию", placeholder: "ru" },
  { key: "welcome_title", label: "Заголовок welcome-экрана", placeholder: "Добро пожаловать в Sanbao!" },
  { key: "welcome_message", label: "Текст welcome-экрана", placeholder: "Я — универсальный AI-ассистент...", multiline: true },
  { key: "onboarding_enabled", label: "Онбординг включён", type: "toggle" },
  { key: "onboarding_steps", label: "Шаги онбординга (JSON)", placeholder: '[{"title":"Шаг 1","text":"..."}]', multiline: true },
  { key: "smtp_host", label: "SMTP Хост", placeholder: "smtp.gmail.com" },
  { key: "smtp_port", label: "SMTP Порт", placeholder: "587" },
  { key: "smtp_user", label: "SMTP Пользователь", placeholder: "email@example.com" },
  { key: "smtp_pass", label: "SMTP Пароль", placeholder: "••••••••" },
  { key: "smtp_from", label: "SMTP Отправитель", placeholder: "Sanbao <noreply@sanbao.ai>" },
  { key: "session_ttl_hours", label: "TTL сессий (часы)", placeholder: "720" },
  { key: "admin_ip_whitelist", label: "IP whitelist для админки (через запятую)", placeholder: "127.0.0.1, 192.168.1.0" },
  { key: "content_filter_enabled", label: "Фильтр контента", type: "toggle" },
  { key: "content_filter_words", label: "Запрещённые слова (через запятую)", placeholder: "слово1, слово2", multiline: true },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        if (data.app_logo) setLogoUrl(data.app_logo);
        setLoading(false);
      });
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append("logo", file);
    const res = await fetch("/api/admin/settings/logo", { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      setLogoUrl(data.url);
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleLogoDelete = async () => {
    await fetch("/api/admin/settings/logo", { method: "DELETE" });
    setLogoUrl(null);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
  };

  if (loading) {
    return <div className="space-y-4">{[...Array(6)].map((_, i) => <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-16" />)}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Системные настройки</h1>
          <p className="text-sm text-text-muted mt-1">Глобальная конфигурация приложения</p>
        </div>
        <Button variant="gradient" size="sm" onClick={handleSave} isLoading={saving}>
          <Save className="h-4 w-4" /> Сохранить
        </Button>
      </div>

      {/* Logo upload */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
        <label className="text-sm font-medium text-text-primary block mb-3">Логотип приложения</label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded-lg border border-border bg-surface-alt p-1" />
          ) : (
            <div className="h-16 w-16 rounded-lg border border-border bg-surface-alt flex items-center justify-center">
              <Image className="h-6 w-6 text-text-muted" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoUpload} className="hidden" />
            <Button variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()} isLoading={uploadingLogo}>
              <Upload className="h-3.5 w-3.5" /> Загрузить
            </Button>
            {logoUrl && (
              <Button variant="secondary" size="sm" onClick={handleLogoDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Удалить
              </Button>
            )}
            <p className="text-xs text-text-muted">PNG, JPEG, SVG, WebP. Макс. 512 КБ.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {SETTING_FIELDS.map((field) => (
          <div key={field.key} className="bg-surface border border-border rounded-2xl p-5">
            <label className="text-sm font-medium text-text-primary block mb-2">{field.label}</label>
            {field.type === "toggle" ? (
              <button
                onClick={() => setSettings({ ...settings, [field.key]: settings[field.key] === "true" ? "false" : "true" })}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${settings[field.key] === "true" ? "bg-accent" : "bg-surface-alt border border-border"}`}
              >
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings[field.key] === "true" ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
            ) : field.multiline ? (
              <textarea
                value={settings[field.key] || ""}
                onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full h-32 px-3 py-2 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              />
            ) : (
              <input
                value={settings[field.key] || ""}
                onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full h-9 px-3 rounded-lg bg-surface-alt border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
