/**
 * Backwards-compatible re-export from the modular settings registry.
 *
 * All settings are now defined in `src/lib/settings/` domain modules.
 * This file exists so that existing imports from `@/lib/settings-registry`
 * continue to work without changes.
 */

export {
  SETTINGS_REGISTRY,
  SETTINGS_MAP,
  CATEGORY_META,
  type SettingCategory,
  type SettingDefinition,
} from "./settings/index";
