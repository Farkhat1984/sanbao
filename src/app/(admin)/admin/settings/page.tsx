"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Save, Search, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { NotificationBar } from "@/components/ui/NotificationBar";
import { SettingRow, LogoUpload } from "@/components/admin/settings";
import type {
  SettingsCategory,
  ApiResponse,
  Notification,
} from "@/components/admin/settings";

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
                  <LogoUpload
                    logoUrl={logoUrl}
                    uploading={uploadingLogo}
                    onUpload={handleLogoUpload}
                    onDelete={handleLogoDelete}
                  />
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
