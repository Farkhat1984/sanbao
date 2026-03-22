/**
 * Email settings — SMTP configuration, sender address.
 */

import type { SettingDefinition } from "./types";

export const EMAIL_SETTINGS: SettingDefinition[] = [
  {
    key: "smtp_host",
    label: "SMTP хост",
    description:
      "Адрес SMTP сервера (например smtp.gmail.com). Перезаписывает переменную SMTP_HOST",
    category: "email",
    type: "string",
    defaultValue: "",
  },
  {
    key: "email_default_smtp_port",
    label: "SMTP порт",
    description:
      "Порт SMTP сервера по умолчанию (587 = STARTTLS, 465 = SSL)",
    category: "email",
    type: "number",
    defaultValue: "587",
    validation: { min: 1, max: 65535 },
  },
  {
    key: "smtp_user",
    label: "SMTP пользователь",
    description:
      "Email/логин для авторизации на SMTP сервере. Перезаписывает переменную SMTP_USER",
    category: "email",
    type: "string",
    defaultValue: "",
  },
  {
    key: "smtp_password",
    label: "SMTP пароль",
    description:
      "Пароль (App Password) для SMTP авторизации. Перезаписывает переменную SMTP_PASS",
    category: "email",
    type: "string",
    sensitive: true,
    defaultValue: "",
  },
  {
    key: "email_default_from",
    label: "Email отправителя",
    description:
      "Email адрес, от имени которого отправляются письма (например Sanbao <user@gmail.com>)",
    category: "email",
    type: "string",
    defaultValue: "noreply@sanbao.ai",
  },
  {
    key: "smtp_from",
    label: "Имя отправителя",
    description:
      "Полное имя отправителя с email (например: Sanbao <noreply@sanbao.ai>). Перезаписывает переменную SMTP_FROM",
    category: "email",
    type: "string",
    defaultValue: "",
  },
];
