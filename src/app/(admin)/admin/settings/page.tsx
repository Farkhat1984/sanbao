"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Save,
  Search,
  RotateCcw,
  AlertTriangle,
  Upload,
  Trash2,
  Image,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

// ─── Types matching API response ───

interface SettingEntry {
  key: string;
  label: string;
  description: string;
  type: "number" | "string" | "boolean";
  value: string;
  defaultValue: string;
  isOverridden: boolean;
  validation?: {
    min?: number;
    max?: number;
    step?: number;
    allowedValues?: string[];
    pattern?: string;
  };
  unit: string;
  sensitive: boolean;
  restartRequired: boolean;
}

interface SettingsCategory {
  key: string;
  label: string;
  description: string;
  order: number;
  settings: SettingEntry[];
}

interface ApiResponse {
  categories: SettingsCategory[];
}

// ─── Notification component (inline toast) ───

interface Notification {
  id: number;
  type: "success" | "error";
  message: string;
}

function NotificationBar({ notifications, onDismiss }: {
  notifications: Notification[];
  onDismiss: (id: number) => void;
}) {
  if (notifications.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in slide-in-from-right-5 ${
            n.type === "success"
              ? "bg-success-light text-success border-success/20"
              : "bg-error-light text-error border-error/20"
          }`}
        >
          {n.type === "success" ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <X className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{n.message}</span>
          <button
            onClick={() => onDismiss(n.id)}
            className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ───

export default function AdminSettingsPage() {
  const [categories, setCategories] = useState<SettingsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const notifIdRef = useRef(0);

  // ─── Notification helpers ───

  const notify = useCallback((type: "success" | "error", message: string) => {
    const id = ++notifIdRef.current;
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const dismissNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // ─── Data fetching ───

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data: ApiResponse = await res.json();
      setCategories(data.categories);

      // Initialize form values from current values
      const values: Record<string, string> = {};
      for (const cat of data.categories) {
        for (const s of cat.settings) {
          values[s.key] = s.value;
        }
      }
      setFormValues(values);
      setDirtyKeys(new Set());
      setErrors({});

      // Set first category as active if none selected
      if (!activeCategory && data.categories.length > 0) {
        setActiveCategory(data.categories[0].key);
      }
    } catch {
      notify("error", "Не удалось загрузить настройки");
    } finally {
      setLoading(false);
    }
  }, [activeCategory, notify]);

  useEffect(() => {
    fetchSettings();

    // Also load logo
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        // Check legacy flat map for logo (backward compat)
        if (data.app_logo) setLogoUrl(data.app_logo);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Logo handlers ───

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/admin/settings/logo", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setLogoUrl(data.url);
        notify("success", "Логотип загружен");
      } else {
        notify("error", "Не удалось загрузить логотип");
      }
    } catch {
      notify("error", "Ошибка загрузки логотипа");
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleLogoDelete = async () => {
    try {
      await fetch("/api/admin/settings/logo", { method: "DELETE" });
      setLogoUrl(null);
      notify("success", "Логотип удалён");
    } catch {
      notify("error", "Ошибка удаления логотипа");
    }
  };

  // ─── Form value change ───

  const handleValueChange = useCallback(
    (key: string, newValue: string) => {
      setFormValues((prev) => ({ ...prev, [key]: newValue }));

      // Find the original server value for this key
      let serverValue = "";
      for (const cat of categories) {
        const setting = cat.settings.find((s) => s.key === key);
        if (setting) {
          serverValue = setting.value;
          break;
        }
      }

      setDirtyKeys((prev) => {
        const next = new Set(prev);
        if (newValue === serverValue) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });

      // Clear error for this key when user changes value
      if (errors[key]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [categories, errors],
  );

  // ─── Save changes ───

  const handleSave = async () => {
    if (dirtyKeys.size === 0) return;

    setSaving(true);
    const changedSettings: Record<string, string> = {};
    for (const key of dirtyKeys) {
      changedSettings[key] = formValues[key];
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: changedSettings }),
      });

      const data = await res.json();

      if (!res.ok || data.errors) {
        if (data.errors) {
          setErrors(data.errors);
          notify("error", `Ошибки валидации (${Object.keys(data.errors).length})`);
        } else {
          notify("error", data.error || "Ошибка сохранения");
        }
      } else {
        notify("success", `Сохранено (${dirtyKeys.size})`);
        await fetchSettings();
      }
    } catch {
      notify("error", "Сетевая ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  // ─── Reset individual setting ───

  const handleResetSetting = async (key: string) => {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: [key] }),
      });
      if (res.ok) {
        notify("success", "Настройка сброшена");
        await fetchSettings();
      } else {
        notify("error", "Не удалось сбросить настройку");
      }
    } catch {
      notify("error", "Сетевая ошибка");
    }
  };

  // ─── Reset category ───

  const handleResetCategory = (categoryKey: string) => {
    const cat = categories.find((c) => c.key === categoryKey);
    if (!cat) return;

    const overriddenKeys = cat.settings
      .filter((s) => s.isOverridden)
      .map((s) => s.key);

    if (overriddenKeys.length === 0) {
      notify("success", "Все настройки уже по умолчанию");
      return;
    }

    setConfirmModal({
      open: true,
      title: `Сбросить "${cat.label}"?`,
      description: `${overriddenKeys.length} настроек будут сброшены к значениям по умолчанию.`,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        try {
          const res = await fetch("/api/admin/settings", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keys: overriddenKeys }),
          });
          if (res.ok) {
            notify("success", `Категория "${cat.label}" сброшена`);
            await fetchSettings();
          } else {
            notify("error", "Ошибка сброса категории");
          }
        } catch {
          notify("error", "Сетевая ошибка");
        }
      },
    });
  };

  // ─── Reset all ───

  const handleResetAll = () => {
    const allOverridden = categories.flatMap((c) =>
      c.settings.filter((s) => s.isOverridden).map((s) => s.key),
    );

    if (allOverridden.length === 0) {
      notify("success", "Все настройки уже по умолчанию");
      return;
    }

    setConfirmModal({
      open: true,
      title: "Сбросить ВСЕ настройки?",
      description: `${allOverridden.length} настроек будут сброшены к значениям по умолчанию. Это действие нельзя отменить.`,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        try {
          const res = await fetch("/api/admin/settings", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keys: allOverridden }),
          });
          if (res.ok) {
            notify("success", "Все настройки сброшены");
            await fetchSettings();
          } else {
            notify("error", "Ошибка сброса");
          }
        } catch {
          notify("error", "Сетевая ошибка");
        }
      },
    });
  };

  // ─── Search filtering ───

  const isSearching = searchQuery.trim().length > 0;

  const filteredCategories = useMemo(() => {
    if (!isSearching) return categories;

    const q = searchQuery.toLowerCase().trim();
    return categories
      .map((cat) => ({
        ...cat,
        settings: cat.settings.filter(
          (s) =>
            s.key.toLowerCase().includes(q) ||
            s.label.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.settings.length > 0);
  }, [categories, searchQuery, isSearching]);

  // Active category data (for non-search mode)
  const activeCategoryData = useMemo(
    () => categories.find((c) => c.key === activeCategory),
    [categories, activeCategory],
  );

  // Modified count per category (includes dirty keys)
  const modifiedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of categories) {
      counts[cat.key] = cat.settings.filter(
        (s) => s.isOverridden || dirtyKeys.has(s.key),
      ).length;
    }
    return counts;
  }, [categories, dirtyKeys]);

  // ─── Loading skeleton ───

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-7 w-52 bg-surface-alt rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-surface-alt rounded-lg animate-pulse mt-2" />
          </div>
        </div>
        <div className="flex gap-6">
          <div className="w-56 shrink-0 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 bg-surface-alt rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="flex-1 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-2xl p-5 animate-pulse h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">
            Системные настройки
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {categories.reduce((sum, c) => sum + c.settings.length, 0)} настроек в{" "}
            {categories.length} категориях
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleResetAll}>
            <RotateCcw className="h-3.5 w-3.5" /> Сбросить всё
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={handleSave}
            isLoading={saving}
            disabled={dirtyKeys.size === 0}
          >
            <Save className="h-4 w-4" />
            {dirtyKeys.size > 0
              ? `Сохранить (${dirtyKeys.size})`
              : "Сохранить"}
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск настроек по названию, ключу или описанию..."
          className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted transition-all duration-150 outline-none focus:border-accent focus:shadow-[var(--shadow-input-focus)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isSearching ? (
        /* Search results — flat list grouped by category */
        <div className="space-y-6">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-secondary">
                Ничего не найдено по запросу &laquo;{searchQuery}&raquo;
              </p>
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <div key={cat.key}>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  {cat.label}
                </h3>
                <div className="space-y-3">
                  {cat.settings.map((setting) => (
                    <SettingRow
                      key={setting.key}
                      setting={setting}
                      value={formValues[setting.key] ?? setting.value}
                      error={errors[setting.key]}
                      isDirty={dirtyKeys.has(setting.key)}
                      onChange={handleValueChange}
                      onReset={handleResetSetting}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Normal mode — sidebar + content */
        <div className="flex gap-6">
          {/* Category sidebar (desktop) */}
          <nav className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-4 space-y-1">
              {categories.map((cat) => {
                const isActive = cat.key === activeCategory;
                const count = modifiedCounts[cat.key] || 0;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm transition-all duration-150 cursor-pointer ${
                      isActive
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                    }`}
                  >
                    <span className="truncate">{cat.label}</span>
                    {count > 0 && (
                      <span
                        className={`ml-2 shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-xs font-medium ${
                          isActive
                            ? "bg-accent text-white"
                            : "bg-surface-alt text-text-secondary"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Category tabs (mobile) */}
          <div className="lg:hidden w-full mb-4">
            <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
              {categories.map((cat) => {
                const isActive = cat.key === activeCategory;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "bg-accent text-white"
                        : "text-text-secondary hover:bg-surface-alt"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Settings content */}
          <div className="flex-1 min-w-0">
            {activeCategoryData && (
              <>
                {/* Category header */}
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">
                      {activeCategoryData.label}
                    </h2>
                    <p className="text-sm text-text-secondary mt-0.5">
                      {activeCategoryData.description}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleResetCategory(activeCategory)}
                    className="shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Сбросить
                  </Button>
                </div>

                {/* Logo upload (shown only in files_storage category) */}
                {activeCategory === "files_storage" && (
                  <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
                    <label className="text-sm font-semibold text-text-primary block mb-3">
                      Логотип приложения
                    </label>
                    <div className="flex items-center gap-4">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="h-16 w-16 object-contain rounded-lg border border-border bg-surface-alt p-1"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg border border-border bg-surface-alt flex items-center justify-center">
                          <Image className="h-6 w-6 text-text-secondary" />
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          isLoading={uploadingLogo}
                        >
                          <Upload className="h-3.5 w-3.5" /> Загрузить
                        </Button>
                        {logoUrl && (
                          <Button variant="secondary" size="sm" onClick={handleLogoDelete}>
                            <Trash2 className="h-3.5 w-3.5" /> Удалить
                          </Button>
                        )}
                        <p className="text-xs text-text-secondary">
                          PNG, JPEG, SVG, WebP. Макс. 512 КБ.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Settings list */}
                <div className="space-y-3">
                  {activeCategoryData.settings.map((setting) => (
                    <SettingRow
                      key={setting.key}
                      setting={setting}
                      value={formValues[setting.key] ?? setting.value}
                      error={errors[setting.key]}
                      isDirty={dirtyKeys.has(setting.key)}
                      onChange={handleValueChange}
                      onReset={handleResetSetting}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating save bar when there are changes */}
      {dirtyKeys.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none flex justify-center pb-6">
          <div className="pointer-events-auto bg-surface border border-border rounded-2xl shadow-xl px-5 py-3 flex items-center gap-4">
            <span className="text-sm text-text-secondary">
              Несохранённых изменений: <strong className="text-text-primary">{dirtyKeys.size}</strong>
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Revert all dirty changes
                  const reverted = { ...formValues };
                  for (const key of dirtyKeys) {
                    for (const cat of categories) {
                      const s = cat.settings.find((s) => s.key === key);
                      if (s) {
                        reverted[key] = s.value;
                        break;
                      }
                    }
                  }
                  setFormValues(reverted);
                  setDirtyKeys(new Set());
                  setErrors({});
                }}
              >
                Отменить
              </Button>
              <Button
                variant="gradient"
                size="sm"
                onClick={handleSave}
                isLoading={saving}
              >
                <Save className="h-4 w-4" />
                Сохранить ({dirtyKeys.size})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      <ConfirmModal
        isOpen={confirmModal.open}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText="Сбросить"
        variant="warning"
      />

      {/* Notifications */}
      <NotificationBar
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </div>
  );
}

// ─── Setting row component ───

function SettingRow({
  setting,
  value,
  error,
  isDirty,
  onChange,
  onReset,
}: {
  setting: SettingEntry;
  value: string;
  error?: string;
  isDirty: boolean;
  onChange: (key: string, value: string) => void;
  onReset: (key: string) => void;
}) {
  const isDefault = value === setting.defaultValue && !setting.isOverridden;
  const showResetButton = setting.isOverridden || isDirty;

  return (
    <div
      className={`bg-surface border rounded-2xl p-5 transition-colors ${
        error
          ? "border-error/40"
          : isDirty
            ? "border-accent/30"
            : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Label row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary">
              {setting.label}
            </span>
            {isDefault && !isDirty && (
              <Badge variant="default">По умолчанию</Badge>
            )}
            {setting.isOverridden && !isDirty && (
              <Badge variant="accent">Изменено</Badge>
            )}
            {isDirty && <Badge variant="warning">Не сохранено</Badge>}
            {setting.restartRequired && (
              <span className="inline-flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                Требуется перезапуск
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            {setting.description}
          </p>

          {/* Key (for devs) */}
          <p className="text-[11px] text-text-muted mt-1 font-mono">
            {setting.key}
          </p>
        </div>

        {/* Reset button */}
        {showResetButton && (
          <button
            onClick={() => onReset(setting.key)}
            title="Сбросить к значению по умолчанию"
            className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:text-warning hover:bg-warning/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Input */}
      <div className="mt-3">
        <SettingInput
          setting={setting}
          value={value}
          error={error}
          onChange={(v) => onChange(setting.key, v)}
        />
      </div>
    </div>
  );
}

// ─── Setting input component ───

function SettingInput({
  setting,
  value,
  error,
  onChange,
}: {
  setting: SettingEntry;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const inputClasses = `h-10 px-4 rounded-xl bg-surface border text-sm text-text-primary transition-all duration-150 outline-none focus:shadow-[var(--shadow-input-focus)] ${
    error
      ? "border-error focus:border-error"
      : "border-border focus:border-accent"
  }`;

  // Boolean toggle
  if (setting.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <Switch
          checked={value === "true"}
          onChange={(checked) => onChange(checked ? "true" : "false")}
          size="md"
        />
        <span className="text-sm text-text-secondary">
          {value === "true" ? "Включено" : "Выключено"}
        </span>
      </div>
    );
  }

  // String with allowedValues — select dropdown
  if (setting.type === "string" && setting.validation?.allowedValues) {
    return (
      <div className="space-y-1.5">
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full sm:w-64 ${inputClasses} appearance-none pr-10 cursor-pointer`}
          >
            {setting.validation.allowedValues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }

  // Number input
  if (setting.type === "number") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            min={setting.validation?.min}
            max={setting.validation?.max}
            step={setting.validation?.step ?? (Number(value) % 1 !== 0 ? 0.1 : 1)}
            className={`w-full sm:w-48 ${inputClasses}`}
          />
          {setting.unit && (
            <span className="text-xs text-text-muted shrink-0">{setting.unit}</span>
          )}
        </div>
        {setting.validation && (
          <p className="text-[11px] text-text-muted">
            {setting.validation.min !== undefined && `Мин: ${setting.validation.min}`}
            {setting.validation.min !== undefined && setting.validation.max !== undefined && " / "}
            {setting.validation.max !== undefined && `Макс: ${setting.validation.max.toLocaleString()}`}
          </p>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }

  // String input (default)
  return (
    <div className="space-y-1.5">
      <input
        type={setting.sensitive ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={setting.defaultValue}
        className={`w-full sm:w-96 ${inputClasses}`}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
