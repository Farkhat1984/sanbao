/**
 * Multi-agent (swarm) settings — classification, consultation timeouts.
 */

import type { SettingDefinition } from "./types";

export const SWARM_SETTINGS: SettingDefinition[] = [
  {
    key: "swarm_classify_timeout_ms",
    label: "Таймаут классификации",
    description:
      "Время ожидания LLM при классификации запроса мультиагентом. Увеличьте при медленных моделях",
    category: "swarm",
    type: "number",
    defaultValue: "60000",
    validation: { min: 5000, max: 300000 },
    unit: "мс",
  },
  {
    key: "swarm_consult_timeout_ms",
    label: "Таймаут консультации агента",
    description:
      "Время ожидания ответа от агента-специалиста в мультиагенте",
    category: "swarm",
    type: "number",
    defaultValue: "60000",
    validation: { min: 5000, max: 300000 },
    unit: "мс",
  },
  {
    key: "swarm_consult_max_tool_turns",
    label: "Макс. tool-итераций консультации",
    description:
      "Количество итераций tool-loop при консультации агентом. Больше = точнее, но дольше",
    category: "swarm",
    type: "number",
    defaultValue: "2",
    validation: { min: 1, max: 10 },
    unit: "шт.",
  },
];
