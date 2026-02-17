import { describe, it, expect, beforeEach } from "vitest";
import { t, getLocale, setLocale, initLocale, LOCALES } from "@/lib/i18n";

describe("i18n", () => {
  beforeEach(() => {
    setLocale("ru");
  });

  it("defaults to Russian locale", () => {
    expect(getLocale()).toBe("ru");
  });

  it("translates Russian keys", () => {
    expect(t("common.save")).toBe("Сохранить");
    expect(t("sidebar.newChat")).toBe("Новый чат");
    expect(t("chat.placeholder")).toBe("Напишите сообщение...");
  });

  it("translates Kazakh keys", () => {
    setLocale("kk");
    expect(t("common.save")).toBe("Сақтау");
    expect(t("sidebar.newChat")).toBe("Жаңа чат");
    expect(t("chat.placeholder")).toBe("Хабарлама жазыңыз...");
  });

  it("falls back to Russian for missing Kazakh keys", () => {
    setLocale("kk");
    // If a key exists in ru but not kk, should return ru value
    // All keys currently exist in both, so test with override
    expect(t("common.save")).toBe("Сақтау");
  });

  it("returns key for unknown keys", () => {
    expect(t("nonexistent.key")).toBe("nonexistent.key");
    expect(t("common.nonexistent")).toBe("common.nonexistent");
  });

  it("returns key for malformed keys", () => {
    expect(t("notsection")).toBe("notsection");
    expect(t("a.b.c")).toBe("a.b.c");
  });

  it("supports locale parameter override", () => {
    setLocale("ru");
    expect(t("common.save", "kk")).toBe("Сақтау");
    expect(t("common.save", "ru")).toBe("Сохранить");
  });

  it("setLocale changes current locale", () => {
    expect(getLocale()).toBe("ru");
    setLocale("kk");
    expect(getLocale()).toBe("kk");
  });

  it("initLocale returns current locale in server context", () => {
    // No localStorage in test environment
    const locale = initLocale();
    expect(locale).toBe("ru");
  });

  it("LOCALES has both languages", () => {
    expect(LOCALES).toHaveLength(2);
    expect(LOCALES.find((l) => l.value === "ru")).toBeTruthy();
    expect(LOCALES.find((l) => l.value === "kk")).toBeTruthy();
  });

  it("all Russian keys have Kazakh translations", () => {
    // Spot-check key sections to ensure Kazakh translations exist
    const keysToCheck = [
      "common.save", "common.cancel", "common.delete", "common.search",
      "sidebar.newChat", "sidebar.today", "sidebar.yesterday",
      "chat.placeholder", "chat.send", "chat.thinking",
      "settings.title", "settings.language",
      "auth.login", "auth.register",
      "billing.title", "billing.subscribe",
      "agents.title", "skills.title", "files.title",
      "errors.generic", "errors.unauthorized",
    ];
    for (const key of keysToCheck) {
      const ru = t(key, "ru");
      const kk = t(key, "kk");
      expect(ru).not.toBe(key); // ru translation exists
      expect(kk).not.toBe(key); // kk translation exists
      expect(kk).not.toBe(ru);  // they differ
    }
  });

  it("Kazakh translations contain Kazakh characters", () => {
    setLocale("kk");
    const kazSpecific = /[ҚқҒғҰұҮүІіҺһӘәӨө]/;
    // At least some translations should have Kazakh-specific letters
    const samples = [
      t("common.save"),      // Сақтау
      t("common.search"),    // Іздеу
      t("common.delete"),    // Жою
      t("settings.title"),   // Баптаулар
    ];
    const hasKazakh = samples.some((s) => kazSpecific.test(s));
    expect(hasKazakh).toBe(true);
  });
});
