/**
 * Miscellaneous settings — auto-fix attempts, slug limits.
 */

import type { SettingDefinition } from "./types";

export const MISC_SETTINGS: SettingDefinition[] = [
  {
    key: "max_auto_fix_attempts",
    label: "Макс. попыток авто-исправления",
    description:
      "Количество попыток автоматического исправления ошибок в коде",
    category: "misc",
    type: "number",
    defaultValue: "3",
    validation: { min: 1, max: 10 },
    unit: "шт.",
  },
  {
    key: "slug_max_length",
    label: "Макс. длина slug",
    description:
      "Максимальная длина URL-slug для агентов и навыков",
    category: "misc",
    type: "number",
    defaultValue: "60",
    validation: { min: 20, max: 200 },
    unit: "символов",
  },
];
