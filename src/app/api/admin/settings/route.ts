import { requireAdmin, resetIpWhitelistCache } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { resetContentFilterCache } from "@/lib/content-filter";
import { resetPromptCache } from "@/lib/prompts";
import { resetTransporter } from "@/lib/email";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import {
  SETTINGS_REGISTRY,
  SETTINGS_MAP,
  CATEGORY_META,
  type SettingCategory,
  type SettingDefinition,
} from "@/lib/settings-registry";
import { getAllSettingsWithValues, invalidateSettings } from "@/lib/settings";

// ─── GET: Return all settings grouped by category with full metadata ───

export async function GET() {
  const result = await requireAdmin();
  if (result.error) return result.error;

  try {
    const settingsWithValues = await getAllSettingsWithValues();
    const valueMap = new Map(
      settingsWithValues.map((s) => [s.key, { value: s.value, isOverridden: s.isOverridden }]),
    );

    // Group settings by category
    const categoryMap = new Map<
      SettingCategory,
      Array<{
        key: string;
        label: string;
        description: string;
        type: SettingDefinition["type"];
        value: string;
        defaultValue: string;
        isOverridden: boolean;
        validation?: SettingDefinition["validation"];
        unit: string;
        sensitive: boolean;
        restartRequired: boolean;
      }>
    >();

    for (const def of SETTINGS_REGISTRY) {
      const resolved = valueMap.get(def.key);
      const entry = {
        key: def.key,
        label: def.label,
        description: def.description,
        type: def.type,
        value: resolved?.value ?? def.defaultValue,
        defaultValue: def.defaultValue,
        isOverridden: resolved?.isOverridden ?? false,
        validation: def.validation,
        unit: def.unit ?? "",
        sensitive: def.sensitive ?? false,
        restartRequired: def.restartRequired ?? false,
      };

      const existing = categoryMap.get(def.category);
      if (existing) {
        existing.push(entry);
      } else {
        categoryMap.set(def.category, [entry]);
      }
    }

    // Build response sorted by category order
    const categories = Array.from(categoryMap.entries())
      .map(([key, settings]) => {
        const meta = CATEGORY_META[key];
        return {
          key,
          label: meta.label,
          description: meta.description,
          order: meta.order,
          settings,
        };
      })
      .sort((a, b) => a.order - b.order);

    return jsonOk({ categories });
  } catch (err) {
    return jsonError(
      `Ошибка загрузки настроек: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
}

// ─── PUT: Validate and upsert settings ─────────────────────────────────

export async function PUT(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  try {
    const body = (await req.json()) as { settings?: Record<string, string> };
    const settings = body.settings;

    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return jsonError('Тело запроса должно содержать объект "settings"', 400);
    }

    const entries = Object.entries(settings);
    if (entries.length === 0) {
      return jsonError("Пустой объект настроек", 400);
    }

    // Validate all keys and values before writing anything
    const errors: Record<string, string> = {};

    for (const [key, rawValue] of entries) {
      const def = SETTINGS_MAP.get(key);
      if (!def) {
        errors[key] = `Неизвестный ключ настройки: ${key}`;
        continue;
      }

      const value = String(rawValue);
      const validationError = validateSettingValue(def, value);
      if (validationError) {
        errors[key] = validationError;
      }
    }

    if (Object.keys(errors).length > 0) {
      return jsonOk({ updated: [], errors }, 400);
    }

    // All valid — upsert each setting
    const updated: string[] = [];

    for (const [key, rawValue] of entries) {
      const value = String(rawValue);
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
      updated.push(key);
    }

    // Invalidate L1/L2 caches and notify other replicas
    await invalidateSettings(updated);

    // Legacy cache resets for backward compatibility
    resetContentFilterCache();
    resetPromptCache();

    // Targeted legacy resets
    if (updated.some((k) => k.startsWith("smtp_") || k.startsWith("email_"))) {
      resetTransporter();
    }
    if (updated.includes("admin_ip_whitelist")) {
      resetIpWhitelistCache();
    }

    // Audit log
    logAudit({
      actorId: result.userId!,
      action: "settings.update",
      target: "SystemSetting",
      details: { keys: updated, count: updated.length },
    }).catch(() => {});

    return jsonOk({ updated });
  } catch (err) {
    return jsonError(
      `Ошибка сохранения настроек: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
}

// ─── DELETE: Reset settings to defaults ─────────────────────────────────

export async function DELETE(req: Request) {
  const result = await requireAdmin();
  if (result.error) return result.error;

  try {
    const body = (await req.json()) as { keys?: string[] };
    const keys = body.keys;

    if (!Array.isArray(keys) || keys.length === 0) {
      return jsonError('Тело запроса должно содержать массив "keys"', 400);
    }

    // Validate all keys exist in registry
    const unknownKeys = keys.filter((k) => !SETTINGS_MAP.has(k));
    if (unknownKeys.length > 0) {
      return jsonError(`Неизвестные ключи: ${unknownKeys.join(", ")}`, 400);
    }

    // Delete rows — values will fall back to registry defaults
    await prisma.systemSetting.deleteMany({
      where: { key: { in: keys } },
    });

    // Invalidate caches
    await invalidateSettings(keys);

    // Legacy cache resets
    resetContentFilterCache();
    resetPromptCache();

    if (keys.some((k) => k.startsWith("smtp_") || k.startsWith("email_"))) {
      resetTransporter();
    }
    if (keys.includes("admin_ip_whitelist")) {
      resetIpWhitelistCache();
    }

    // Audit log
    logAudit({
      actorId: result.userId!,
      action: "settings.reset",
      target: "SystemSetting",
      details: { keys, count: keys.length },
    }).catch(() => {});

    return jsonOk({ reset: keys });
  } catch (err) {
    return jsonError(
      `Ошибка сброса настроек: ${err instanceof Error ? err.message : String(err)}`,
      500,
    );
  }
}

// ─── Validation helper ──────────────────────────────────────────────────

/**
 * Validate a setting value against its registry definition.
 * Returns an error message string, or null if valid.
 */
function validateSettingValue(def: SettingDefinition, value: string): string | null {
  switch (def.type) {
    case "boolean": {
      if (value !== "true" && value !== "false") {
        return `"${def.key}" должен быть "true" или "false"`;
      }
      return null;
    }

    case "number": {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        return `"${def.key}" должен быть числом`;
      }
      if (def.validation?.min !== undefined && num < def.validation.min) {
        return `"${def.key}" не может быть меньше ${def.validation.min}`;
      }
      if (def.validation?.max !== undefined && num > def.validation.max) {
        return `"${def.key}" не может быть больше ${def.validation.max}`;
      }
      return null;
    }

    case "string": {
      if (def.validation?.allowedValues && !def.validation.allowedValues.includes(value)) {
        return `"${def.key}" должен быть одним из: ${def.validation.allowedValues.join(", ")}`;
      }
      if (def.validation?.pattern) {
        const regex = new RegExp(def.validation.pattern);
        if (!regex.test(value)) {
          return `"${def.key}" не соответствует формату: ${def.validation.pattern}`;
        }
      }
      return null;
    }

    default:
      return null;
  }
}
