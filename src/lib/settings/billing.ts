/**
 * Billing settings — currency, Stripe, Freedom Pay, expiry warnings.
 */

import type { SettingDefinition } from "./types";

export const BILLING_SETTINGS: SettingDefinition[] = [
  {
    key: "billing_default_currency",
    label: "Валюта по умолчанию",
    description: "Валюта для отображения цен и биллинга",
    category: "billing",
    type: "string",
    defaultValue: "USD",
    validation: { allowedValues: ["USD", "KZT", "EUR", "RUB"] },
  },
  {
    key: "billing_expiry_warning_days",
    label: "Дни предупреждения",
    description:
      "За сколько дней до окончания подписки отправлять уведомление пользователю",
    category: "billing",
    type: "number",
    defaultValue: "3",
    validation: { min: 1, max: 30 },
    unit: "дней",
  },
  {
    key: "stripe_secret_key",
    label: "Stripe Secret Key",
    description:
      "Секретный ключ Stripe API (sk_live_... или sk_test_...). Перезаписывает переменную STRIPE_SECRET_KEY",
    category: "billing",
    type: "string",
    sensitive: true,
    defaultValue: "",
  },
  {
    key: "stripe_webhook_secret",
    label: "Stripe Webhook Secret",
    description:
      "Секрет для проверки подписи вебхуков Stripe (whsec_...). Перезаписывает переменную STRIPE_WEBHOOK_SECRET",
    category: "billing",
    type: "string",
    sensitive: true,
    defaultValue: "",
  },
  {
    key: "freedom_pay_merchant_id",
    label: "Freedom Pay Merchant ID",
    description:
      "Числовой ID мерчанта в Freedom Pay. Перезаписывает переменную FREEDOM_PAY_MERCHANT_ID",
    category: "billing",
    type: "string",
    defaultValue: "",
  },
  {
    key: "freedom_pay_secret_key",
    label: "Freedom Pay Secret Key",
    description:
      "Секретный ключ мерчанта Freedom Pay для подписи запросов. Перезаписывает переменную FREEDOM_PAY_SECRET_KEY",
    category: "billing",
    type: "string",
    sensitive: true,
    defaultValue: "",
  },
  {
    key: "freedom_pay_testing_mode",
    label: "Freedom Pay тестовый режим",
    description:
      "Включить тестовый режим Freedom Pay (1 = тест, 0 = прод). Перезаписывает переменную FREEDOM_PAY_TESTING_MODE",
    category: "billing",
    type: "string",
    defaultValue: "0",
    validation: { allowedValues: ["0", "1"] },
  },
];
