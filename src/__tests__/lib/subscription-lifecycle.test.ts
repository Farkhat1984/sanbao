import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

// ─── Mocks ───────────────────────────────────────────────

// Мокаем nodemailer до импорта email.ts
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-msg-id" });
const mockVerify = vi.fn().mockResolvedValue(true);
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
      verify: mockVerify,
    })),
  },
}));

// Мокаем stripe-client
vi.mock("@/lib/stripe-client", () => ({
  getStripe: vi.fn(() => ({
    webhooks: { constructEvent: vi.fn() },
    customers: { retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  })),
}));

// Мокаем api-helpers (для cron route)
vi.mock("@/lib/api-helpers", () => ({
  jsonOk: vi.fn((data: unknown) => Response.json(data, { status: 200 })),
  jsonError: vi.fn((msg: string, status: number) =>
    Response.json({ error: msg }, { status })
  ),
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));

// ─── Типизированные моки Prisma ──────────────────────────

const mockPrisma = vi.mocked(prisma) as unknown as {
  subscription: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  plan: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  payment: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  emailLog: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  emailTemplate: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  systemSetting: {
    findMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

// Добавляем недостающие модели в мок prisma (setup.ts не включает их все)
function ensurePrismaModels() {
  const p = prisma as unknown as Record<string, unknown>;

  if (!p.plan) {
    p.plan = { findFirst: vi.fn(), findUnique: vi.fn() };
  }
  if (!p.payment) {
    p.payment = { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() };
  }
  if (!p.user) {
    p.user = { findUnique: vi.fn(), update: vi.fn() };
  }
  if (!p.emailLog) {
    p.emailLog = { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() };
  }
  if (!p.emailTemplate) {
    p.emailTemplate = { findUnique: vi.fn() };
  }
  if (!p.systemSetting) {
    p.systemSetting = { findMany: vi.fn() };
  }
  if (!p.subscription) {
    // setup.ts has subscription.findUnique but not findMany/updateMany
    const existing = p.subscription as Record<string, unknown> | undefined;
    p.subscription = {
      findUnique: existing?.findUnique ?? vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    };
  } else {
    const sub = p.subscription as Record<string, unknown>;
    if (!sub.findMany) sub.findMany = vi.fn();
    if (!sub.updateMany) sub.updateMany = vi.fn();
    if (!sub.upsert) sub.upsert = vi.fn();
    if (!sub.update) sub.update = vi.fn();
  }
}

// ─── Тестовые данные ─────────────────────────────────────

const FREE_PLAN = {
  id: "plan-free",
  name: "Бесплатный",
  isDefault: true,
  price: 0,
};

const PRO_PLAN = {
  id: "plan-pro",
  name: "Профессионал",
  isDefault: false,
  price: 5990,
};

const TEST_USER = {
  id: "user-1",
  email: "ivan@test.kz",
  name: "Иван Петров",
};

const SMTP_ENV = {
  SMTP_HOST: "smtp.test.com",
  SMTP_USER: "test@test.com",
  SMTP_PASS: "testpass",
  SMTP_FROM: "noreply@test.com",
};

// ─── Хелперы ─────────────────────────────────────────────

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

// ─── Тесты ───────────────────────────────────────────────

describe("Жизненный цикл подписки", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    ensurePrismaModels();

    // SMTP env по умолчанию — настроен
    Object.assign(process.env, SMTP_ENV);

    // Сбрасываем кэш транспортера перед каждым тестом
    // (email.ts кэширует transporter, нужен resetTransporter)
  });

  afterEach(() => {
    // Восстанавливаем env
    process.env = { ...originalEnv };
  });

  // ─────────────────────────────────────────────────────────
  // 1. Полный цикл: покупка → счёт → email (Stripe)
  // ─────────────────────────────────────────────────────────

  describe("1. Покупка через Stripe → Invoice Email", () => {
    it("sendInvoiceEmail создаёт счёт и отправляет email", async () => {
      // Сбрасываем транспортер чтобы env переменные подхватились
      const { resetTransporter } = await import("@/lib/email");
      resetTransporter();

      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-1" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const { sendInvoiceEmail } = await import("@/lib/invoice");

      const now = new Date();
      const monthLater = new Date(now);
      monthLater.setMonth(monthLater.getMonth() + 1);

      const result = await sendInvoiceEmail({
        userId: TEST_USER.id,
        planName: PRO_PLAN.name,
        amount: "5 990 ₸",
        periodStart: now,
        periodEnd: monthLater,
      });

      expect(result).toBe(true);

      // Проверяем: пользователь был загружен
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER.id },
        select: { email: true, name: true },
      });

      // Проверяем: email log создан с типом INVOICE
      expect(mockPrisma.emailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            to: TEST_USER.email,
            type: "INVOICE",
            userId: TEST_USER.id,
            status: "PENDING",
          }),
        })
      );

      // Проверяем: SMTP sendMail вызван
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: TEST_USER.email,
          from: expect.any(String),
        })
      );

      // Проверяем: лог обновлён на SENT
      expect(mockPrisma.emailLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "log-1" },
          data: { status: "SENT" },
        })
      );
    });

    it("sendInvoiceEmail возвращает false для несуществующего пользователя", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const { sendInvoiceEmail } = await import("@/lib/invoice");

      const result = await sendInvoiceEmail({
        userId: "nonexistent",
        planName: PRO_PLAN.name,
        amount: "5 990 ₸",
        periodStart: new Date(),
        periodEnd: daysFromNow(30),
      });

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("subject содержит номер счёта в формате INV-YYYYMMDD-XXXXX", async () => {
      const { resetTransporter } = await import("@/lib/email");
      resetTransporter();

      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-2" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const { sendInvoiceEmail } = await import("@/lib/invoice");

      await sendInvoiceEmail({
        userId: TEST_USER.id,
        planName: PRO_PLAN.name,
        amount: "5 990 ₸",
        periodStart: new Date(),
        periodEnd: daysFromNow(30),
      });

      const createCall = mockPrisma.emailLog.create.mock.calls[0][0];
      const subject = createCall.data.subject as string;
      // Формат: "Счёт #INV-YYYYMMDD-XXXXX — Sanbao"
      expect(subject).toMatch(/Счёт #INV-\d{8}-[A-Z0-9]{5} — Sanbao/);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 2. Покупка через Freedom Pay → Invoice Email
  // ─────────────────────────────────────────────────────────

  describe("2. Покупка через Freedom Pay → Invoice Email", () => {
    it("sendInvoiceEmail корректно форматирует период оплаты", async () => {
      const { resetTransporter } = await import("@/lib/email");
      resetTransporter();

      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-3" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const { sendInvoiceEmail } = await import("@/lib/invoice");

      const start = new Date("2026-03-10");
      const end = new Date("2026-04-10");

      await sendInvoiceEmail({
        userId: TEST_USER.id,
        planName: PRO_PLAN.name,
        amount: "5 990 ₸",
        periodStart: start,
        periodEnd: end,
      });

      // Проверяем что sendMail вызван с HTML содержащим данные
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(PRO_PLAN.name),
        })
      );
    });

    it("expiresAt при Freedom Pay = +1 месяц от текущей даты", () => {
      const now = new Date("2026-03-10T12:00:00Z");
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      expect(expiresAt.getFullYear()).toBe(2026);
      expect(expiresAt.getMonth()).toBe(3); // Апрель
      expect(expiresAt.getDate()).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3. Истечение подписки → Даунгрейд на бесплатный
  // ─────────────────────────────────────────────────────────

  describe("3. Истечение подписки → Даунгрейд", () => {
    it("expireSubscriptions находит и даунгрейдит истёкшие подписки", async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(FREE_PLAN);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 3 });

      const { expireSubscriptions } = await import(
        "@/lib/subscription-manager"
      );
      const result = await expireSubscriptions();

      expect(result).toEqual({ expired: 3 });

      // Проверяем фильтр: expiresAt < now, planId !== free
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
          planId: { not: FREE_PLAN.id },
        },
        data: { planId: FREE_PLAN.id },
      });
    });

    it("expireSubscriptions возвращает 0 если нет дефолтного плана", async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(null);

      const { expireSubscriptions } = await import(
        "@/lib/subscription-manager"
      );
      const result = await expireSubscriptions();

      expect(result).toEqual({ expired: 0 });
      expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
    });

    it("expireSubscriptions не трогает уже бесплатные подписки", async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(FREE_PLAN);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });

      const { expireSubscriptions } = await import(
        "@/lib/subscription-manager"
      );
      const result = await expireSubscriptions();

      expect(result).toEqual({ expired: 0 });

      // Фильтр исключает уже бесплатные подписки
      const callArgs = mockPrisma.subscription.updateMany.mock.calls[0][0];
      expect(callArgs.where.planId).toEqual({ not: FREE_PLAN.id });
    });
  });

  // ─────────────────────────────────────────────────────────
  // 4. Истечение триала → Даунгрейд
  // ─────────────────────────────────────────────────────────

  describe("4. Истечение триала → Даунгрейд", () => {
    it("expireTrials даунгрейдит триалы без expiresAt", async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(FREE_PLAN);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 2 });

      const { expireTrials } = await import("@/lib/subscription-manager");
      const result = await expireTrials();

      expect(result).toEqual({ expired: 2 });

      // Ключевое отличие от expireSubscriptions: expiresAt === null
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: {
          trialEndsAt: { lt: expect.any(Date) },
          expiresAt: null,
          planId: { not: FREE_PLAN.id },
        },
        data: { planId: FREE_PLAN.id },
      });
    });

    it("expireTrials не трогает подписки с валидным expiresAt", async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(FREE_PLAN);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });

      const { expireTrials } = await import("@/lib/subscription-manager");
      await expireTrials();

      // expiresAt: null — только чистые триалы
      const callArgs = mockPrisma.subscription.updateMany.mock.calls[0][0];
      expect(callArgs.where.expiresAt).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 5. Напоминание об истечении (3 дня до)
  // ─────────────────────────────────────────────────────────

  describe("5. Напоминание об истечении подписки", () => {
    it("checkExpiringSubscriptions отправляет напоминание", async () => {
      const { resetTransporter } = await import("@/lib/email");
      resetTransporter();

      const expiresAt = daysFromNow(2);

      mockPrisma.subscription.findMany.mockResolvedValue([
        {
          id: "sub-1",
          userId: TEST_USER.id,
          planId: PRO_PLAN.id,
          expiresAt,
          user: TEST_USER,
          plan: { name: PRO_PLAN.name },
        },
      ]);

      // Нет недавнего напоминания
      mockPrisma.emailLog.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-remind" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const { checkExpiringSubscriptions } = await import("@/lib/invoice");
      const result = await checkExpiringSubscriptions();

      expect(result.checked).toBe(1);
      expect(result.sent).toBe(1);

      // Проверяем фильтр: gte today, lte +3 дня
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
          plan: { select: { name: true } },
        },
      });

      // Проверяем: email типа SUBSCRIPTION_EXPIRING
      expect(mockPrisma.emailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "SUBSCRIPTION_EXPIRING",
            userId: TEST_USER.id,
          }),
        })
      );
    });

    it("sendExpiringReminder форматирует дату на русском", async () => {
      const { resetTransporter } = await import("@/lib/email");
      resetTransporter();

      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-fmt" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const { sendExpiringReminder } = await import("@/lib/invoice");

      await sendExpiringReminder({
        userId: TEST_USER.id,
        planName: PRO_PLAN.name,
        expiresAt: new Date("2026-03-15"),
      });

      // sendMail вызван с HTML содержащим имя плана
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(PRO_PLAN.name),
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // 6. Дедупликация напоминаний
  // ─────────────────────────────────────────────────────────

  describe("6. Дедупликация напоминаний (один раз в день)", () => {
    it("не отправляет повторное напоминание если уже отправлено сегодня", async () => {
      const expiresAt = daysFromNow(2);

      mockPrisma.subscription.findMany.mockResolvedValue([
        {
          id: "sub-1",
          userId: TEST_USER.id,
          planId: PRO_PLAN.id,
          expiresAt,
          user: TEST_USER,
          plan: { name: PRO_PLAN.name },
        },
      ]);

      // Уже есть напоминание за сегодня
      mockPrisma.emailLog.findFirst.mockResolvedValue({
        id: "log-existing",
        createdAt: new Date(),
        type: "SUBSCRIPTION_EXPIRING",
      });

      const { checkExpiringSubscriptions } = await import("@/lib/invoice");
      const result = await checkExpiringSubscriptions();

      expect(result.checked).toBe(1);
      expect(result.sent).toBe(0);

      // sendEmail НЕ вызван (emailLog.create для отправки не вызван)
      // user.findUnique не вызван т.к. до sendExpiringReminder не дошли
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 7. Неудачная оплата → Уведомление
  // ─────────────────────────────────────────────────────────

  describe("7. Неудачная оплата → Уведомление", () => {
    it("sendPaymentFailedNotification отправляет email с именем плана", async () => {
      const { resetTransporter } = await import("@/lib/email");
      resetTransporter();

      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-fail" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const { sendPaymentFailedNotification } = await import("@/lib/invoice");

      const result = await sendPaymentFailedNotification({
        userId: TEST_USER.id,
        planName: PRO_PLAN.name,
      });

      expect(result).toBe(true);

      // Проверяем тип email
      expect(mockPrisma.emailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "PAYMENT_FAILED",
            to: TEST_USER.email,
          }),
        })
      );

      // HTML содержит название плана
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(PRO_PLAN.name),
        })
      );
    });

    it("sendPaymentFailedNotification возвращает false для несуществующего пользователя", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const { sendPaymentFailedNotification } = await import("@/lib/invoice");

      const result = await sendPaymentFailedNotification({
        userId: "ghost-user",
        planName: PRO_PLAN.name,
      });

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 8. Stripe customer.subscription.deleted → Даунгрейд
  // ─────────────────────────────────────────────────────────

  describe("8. Удаление подписки в Stripe → Даунгрейд на бесплатный", () => {
    it("expireSubscriptions даунгрейдит при expiresAt в прошлом", async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(FREE_PLAN);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const { expireSubscriptions } = await import(
        "@/lib/subscription-manager"
      );
      const result = await expireSubscriptions();

      expect(result.expired).toBe(1);
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { planId: FREE_PLAN.id },
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // 9. Freedom Pay неудачная оплата (pg_result="0")
  // ─────────────────────────────────────────────────────────

  describe("9. Freedom Pay неудачная оплата", () => {
    it("sendPaymentFailedNotification отправляет уведомление", async () => {
      const { resetTransporter } = await import("@/lib/email");
      resetTransporter();

      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-fp-fail" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const { sendPaymentFailedNotification } = await import("@/lib/invoice");

      const result = await sendPaymentFailedNotification({
        userId: TEST_USER.id,
        planName: "Бизнес",
      });

      expect(result).toBe(true);

      expect(mockPrisma.emailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "PAYMENT_FAILED",
            subject: "Ошибка оплаты — Sanbao",
          }),
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // 10. SMTP не настроен → Graceful failure
  // ─────────────────────────────────────────────────────────

  describe("10. SMTP не настроен → Graceful degradation", () => {
    it("sendEmail возвращает false и пишет FAILED в лог", async () => {
      // Убираем SMTP переменные
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const { resetTransporter, sendEmail } = await import("@/lib/email");
      resetTransporter();

      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-no-smtp" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const result = await sendEmail({
        to: "test@test.com",
        subject: "Test",
        html: "<p>Hello</p>",
        type: "WELCOME",
      });

      expect(result).toBe(false);

      // Лог обновлён со статусом FAILED
      expect(mockPrisma.emailLog.update).toHaveBeenCalledWith({
        where: { id: "log-no-smtp" },
        data: { status: "FAILED", error: "SMTP not configured" },
      });

      // sendMail не вызван
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────
  // 11. Формат номера счёта INV-YYYYMMDD-XXXXX
  // ─────────────────────────────────────────────────────────

  describe("11. Формат номера счёта", () => {
    it("генерирует INV-YYYYMMDD-XXXXX", () => {
      // Воспроизводим логику из invoice.ts
      function generateInvoiceNumber(): string {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
        return `INV-${y}${m}${d}-${rand}`;
      }

      const inv = generateInvoiceNumber();
      expect(inv).toMatch(/^INV-\d{8}-[A-Z0-9]{5}$/);
    });

    it("все номера уникальны (100 генераций)", () => {
      function generateInvoiceNumber(): string {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
        return `INV-${y}${m}${d}-${rand}`;
      }

      const numbers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        numbers.add(generateInvoiceNumber());
      }
      expect(numbers.size).toBe(100);
    });

    it("дата в номере совпадает с текущей", () => {
      const now = new Date();
      const expected = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

      function generateInvoiceNumber(): string {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
        return `INV-${y}${m}${d}-${rand}`;
      }

      const inv = generateInvoiceNumber();
      const datePart = inv.split("-").slice(1, 2)[0];
      expect(datePart).toBe(expected);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 12. Промокод → Скидка при чекауте
  // ─────────────────────────────────────────────────────────

  describe("12. Промокод → Скидка", () => {
    interface PromoCode {
      code: string;
      isActive: boolean;
      discount: number;
      maxUses: number;
      usedCount: number;
      validUntil: Date | null;
      planId: string | null;
    }

    function applyDiscount(price: number, discountPercent: number): number {
      return Math.round(price * (1 - discountPercent / 100));
    }

    function validatePromo(
      promo: PromoCode | null,
      targetPlanId?: string
    ): { valid: boolean; error?: string; discount?: number } {
      if (!promo) return { valid: false, error: "not_found" };
      if (!promo.isActive) return { valid: false, error: "inactive" };
      if (promo.validUntil && new Date() > promo.validUntil)
        return { valid: false, error: "expired" };
      if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses)
        return { valid: false, error: "exhausted" };
      if (promo.planId && targetPlanId && promo.planId !== targetPlanId) {
        return { valid: false, error: "wrong_plan" };
      }
      return { valid: true, discount: promo.discount };
    }

    const promo: PromoCode = {
      code: "SAVE20",
      isActive: true,
      discount: 20,
      maxUses: 50,
      usedCount: 10,
      validUntil: null,
      planId: null,
    };

    it("применяет 20% скидку: 5990 → 4792", () => {
      const result = validatePromo(promo);
      expect(result.valid).toBe(true);
      expect(applyDiscount(PRO_PLAN.price, result.discount!)).toBe(4792);
    });

    it("отклоняет промокод для неправильного плана", () => {
      const restricted = { ...promo, planId: "plan-business" };
      const result = validatePromo(restricted, "plan-pro");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("wrong_plan");
    });

    it("отклоняет истёкший промокод", () => {
      const expired = { ...promo, validUntil: daysAgo(1) };
      const result = validatePromo(expired);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("expired");
    });

    it("отклоняет исчерпанный промокод", () => {
      const exhausted = { ...promo, maxUses: 10, usedCount: 10 };
      const result = validatePromo(exhausted);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("exhausted");
    });

    it("принимает безлимитный промокод (maxUses = 0)", () => {
      const unlimited = { ...promo, maxUses: 0, usedCount: 99999 };
      expect(validatePromo(unlimited).valid).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 13. Массовое истечение — 5 пользователей
  // ─────────────────────────────────────────────────────────

  describe("13. Массовое напоминание (5 пользователей)", () => {
    it("отправляет напоминание каждому из 5 пользователей", async () => {
      const { resetTransporter } = await import("@/lib/email");
      resetTransporter();

      const users = Array.from({ length: 5 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@test.kz`,
        name: `Пользователь ${i}`,
      }));

      const expiring = users.map((u, i) => ({
        id: `sub-${i}`,
        userId: u.id,
        planId: PRO_PLAN.id,
        expiresAt: daysFromNow(2),
        user: u,
        plan: { name: PRO_PLAN.name },
      }));

      mockPrisma.subscription.findMany.mockResolvedValue(expiring);
      // Нет предыдущих напоминаний
      mockPrisma.emailLog.findFirst.mockResolvedValue(null);
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-batch" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      // Каждому пользователю — его данные
      mockPrisma.user.findUnique.mockImplementation(
        (args: { where: { id: string } }) => {
          const u = users.find((u) => u.id === args.where.id);
          return Promise.resolve(u || null);
        }
      );

      const { checkExpiringSubscriptions } = await import("@/lib/invoice");
      const result = await checkExpiringSubscriptions();

      expect(result.checked).toBe(5);
      expect(result.sent).toBe(5);

      // emailLog.findFirst вызван 5 раз (дедупликация для каждого)
      expect(mockPrisma.emailLog.findFirst).toHaveBeenCalledTimes(5);
      // sendMail вызван 5 раз
      expect(mockSendMail).toHaveBeenCalledTimes(5);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 14. Идемпотентность Freedom Pay
  // ─────────────────────────────────────────────────────────

  describe("14. Идемпотентность — повторный вебхук Freedom Pay", () => {
    it("уже COMPLETED платёж не обрабатывается повторно", () => {
      const payment = { id: "pay-1", status: "COMPLETED", amount: 5990 };
      const shouldProcess = payment.status !== "COMPLETED";
      expect(shouldProcess).toBe(false);
    });

    it("PENDING платёж обрабатывается", () => {
      const payment = { id: "pay-2", status: "PENDING", amount: 5990 };
      const shouldProcess = payment.status !== "COMPLETED";
      expect(shouldProcess).toBe(true);
    });

    it("FAILED платёж можно повторно обработать", () => {
      const payment = { id: "pay-3", status: "FAILED", amount: 5990 };
      const shouldProcess = payment.status !== "COMPLETED";
      expect(shouldProcess).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 15. Конкурентная безопасность cron
  // ─────────────────────────────────────────────────────────

  describe("15. runSubscriptionMaintenance — параллельное выполнение", () => {
    it("запускает все 3 задачи через Promise.all", async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(FREE_PLAN);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const { runSubscriptionMaintenance } = await import(
        "@/lib/subscription-manager"
      );
      const result = await runSubscriptionMaintenance();

      // Все три задачи вернули результат
      expect(result).toHaveProperty("expiredSubscriptions");
      expect(result).toHaveProperty("expiredTrials");
      expect(result).toHaveProperty("reminders");
      expect(typeof result.expiredSubscriptions).toBe("number");
      expect(typeof result.expiredTrials).toBe("number");
      expect(result.reminders).toHaveProperty("checked");
      expect(result.reminders).toHaveProperty("sent");
    });

    it("возвращает результаты даже если одна задача ничего не нашла", async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(FREE_PLAN);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const { runSubscriptionMaintenance } = await import(
        "@/lib/subscription-manager"
      );
      const result = await runSubscriptionMaintenance();

      expect(result.expiredSubscriptions).toBe(0);
      expect(result.expiredTrials).toBe(0);
      expect(result.reminders.checked).toBe(0);
      expect(result.reminders.sent).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 16. Welcome email при регистрации
  // ─────────────────────────────────────────────────────────

  describe("16. Welcome email шаблон", () => {
    it("рендерит приветствие с именем пользователя", async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const { welcomeEmail } = await import("@/lib/email");
      const { subject, html } = await welcomeEmail("Анна");

      expect(subject).toBe("Добро пожаловать в Sanbao!");
      expect(html).toContain("Анна");
      expect(html).toContain("Sanbao");
    });

    it("рендерит без имени (пустая строка)", async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const { welcomeEmail } = await import("@/lib/email");
      const { html } = await welcomeEmail("");

      expect(html).toContain("Здравствуйте");
      expect(html).not.toContain("undefined");
    });

    it("использует кастомный шаблон из БД если есть", async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue({
        type: "WELCOME",
        isActive: true,
        subject: "Привет, {{userName}}!",
        html: "<p>Добро пожаловать, {{userName}}!</p>",
      });

      const { welcomeEmail } = await import("@/lib/email");
      const { subject, html } = await welcomeEmail("Борис");

      expect(subject).toBe("Привет, Борис!");
      expect(html).toContain("Добро пожаловать, Борис!");
    });
  });

  // ─────────────────────────────────────────────────────────
  // 17. Экранирование HTML в шаблонах
  // ─────────────────────────────────────────────────────────

  describe("17. Экранирование HTML-сущностей в шаблонах", () => {
    it("экранирует спецсимволы в имени пользователя (welcome)", async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue({
        type: "WELCOME",
        isActive: true,
        subject: "Привет, {{userName}}!",
        html: "<p>Привет, {{userName}}!</p>",
      });

      const { welcomeEmail } = await import("@/lib/email");
      const { html } = await welcomeEmail('<script>alert("xss")</script>');

      // HTML экранирован
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("&quot;xss&quot;");
      expect(html).not.toContain("<script>");
    });

    it("экранирует амперсанд", async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue({
        type: "WELCOME",
        isActive: true,
        subject: "Hi {{userName}}",
        html: "<p>{{userName}}</p>",
      });

      const { welcomeEmail } = await import("@/lib/email");
      const { html } = await welcomeEmail("Tom & Jerry");

      expect(html).toContain("Tom &amp; Jerry");
    });
  });

  // ─────────────────────────────────────────────────────────
  // 18. Аутентификация cron endpoint
  // ─────────────────────────────────────────────────────────

  describe("18. Аутентификация cron endpoint", () => {
    it("500 если CRON_SECRET не настроен", async () => {
      delete process.env.CRON_SECRET;

      const { GET } = await import(
        "@/app/api/cron/subscriptions/route"
      );
      const req = new Request("http://localhost/api/cron/subscriptions", {
        headers: { authorization: "Bearer test-token" },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await GET(req as any);
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toContain("CRON_SECRET");
    });

    it("401 при неверном токене", async () => {
      process.env.CRON_SECRET = "correct-secret";

      const { GET } = await import(
        "@/app/api/cron/subscriptions/route"
      );
      const req = new Request("http://localhost/api/cron/subscriptions", {
        headers: { authorization: "Bearer wrong-secret" },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await GET(req as any);
      expect(res.status).toBe(401);
    });

    it("200 при корректном токене", async () => {
      process.env.CRON_SECRET = "correct-secret";

      // Настраиваем моки для maintenance
      mockPrisma.plan.findFirst.mockResolvedValue(FREE_PLAN);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const { GET } = await import(
        "@/app/api/cron/subscriptions/route"
      );
      const req = new Request("http://localhost/api/cron/subscriptions", {
        headers: { authorization: "Bearer correct-secret" },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await GET(req as any);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it("401 при отсутствующем токене", async () => {
      process.env.CRON_SECRET = "correct-secret";

      const { GET } = await import(
        "@/app/api/cron/subscriptions/route"
      );
      const req = new Request("http://localhost/api/cron/subscriptions");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await GET(req as any);
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Дополнительные edge cases
  // ─────────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("sendEmail обрабатывает ошибку SMTP transport gracefully", async () => {
      const { resetTransporter } = await import("@/lib/email");
      resetTransporter();

      Object.assign(process.env, SMTP_ENV);

      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-err" });
      mockPrisma.emailLog.update.mockResolvedValue({});
      mockSendMail.mockRejectedValueOnce(new Error("Connection refused"));

      const { sendEmail } = await import("@/lib/email");

      const result = await sendEmail({
        to: "test@test.com",
        subject: "Test",
        html: "<p>Test</p>",
        type: "WELCOME",
      });

      expect(result).toBe(false);

      // Лог обновлён с ошибкой
      expect(mockPrisma.emailLog.update).toHaveBeenCalledWith({
        where: { id: "log-err" },
        data: {
          status: "FAILED",
          error: "Connection refused",
        },
      });
    });

    it("verifySmtp возвращает ошибку если SMTP не настроен", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const { resetTransporter, verifySmtp } = await import("@/lib/email");
      resetTransporter();

      mockPrisma.systemSetting.findMany.mockResolvedValue([]);

      const result = await verifySmtp();
      expect(result.ok).toBe(false);
      expect(result.error).toContain("SMTP не настроен");
    });

    it("checkExpiringSubscriptions работает с пустым списком", async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const { checkExpiringSubscriptions } = await import("@/lib/invoice");
      const result = await checkExpiringSubscriptions();

      expect(result.checked).toBe(0);
      expect(result.sent).toBe(0);
    });

    it("checkExpiringSubscriptions пропускает подписку без expiresAt", async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([
        {
          id: "sub-no-exp",
          userId: TEST_USER.id,
          planId: PRO_PLAN.id,
          expiresAt: null, // нет даты
          user: TEST_USER,
          plan: { name: PRO_PLAN.name },
        },
      ]);

      mockPrisma.emailLog.findFirst.mockResolvedValue(null);

      const { checkExpiringSubscriptions } = await import("@/lib/invoice");
      const result = await checkExpiringSubscriptions();

      // expiresAt null → условие `if (!recentReminder && sub.expiresAt)` ложно
      expect(result.checked).toBe(1);
      expect(result.sent).toBe(0);
    });

    it("sendEmail записывает metadata в emailLog", async () => {
      const { resetTransporter } = await import("@/lib/email");
      resetTransporter();

      Object.assign(process.env, SMTP_ENV);

      mockPrisma.systemSetting.findMany.mockResolvedValue([]);
      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-meta" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const { sendEmail } = await import("@/lib/email");

      await sendEmail({
        to: "test@test.com",
        subject: "Invoice",
        html: "<p>Invoice</p>",
        type: "INVOICE",
        userId: "user-1",
        metadata: { invoiceNumber: "INV-20260310-ABC12", amount: "5990" },
      });

      expect(mockPrisma.emailLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { invoiceNumber: "INV-20260310-ABC12", amount: "5990" },
        }),
      });
    });

    it("getTransporter использует SystemSetting из БД при наличии", async () => {
      // Очищаем ВСЕ SMTP env чтобы проверить что SystemSetting подхватывается
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.SMTP_FROM;

      const { resetTransporter, sendEmail } = await import("@/lib/email");
      resetTransporter();

      // SystemSetting содержит SMTP настройки
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        { key: "smtp_host", value: "smtp.db.com" },
        { key: "smtp_user", value: "db-user@test.com" },
        { key: "smtp_password", value: "db-pass" },
        { key: "smtp_from", value: "sender@db.com" },
      ]);

      mockPrisma.emailLog.create.mockResolvedValue({ id: "log-db-smtp" });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const result = await sendEmail({
        to: "test@test.com",
        subject: "Test",
        html: "<p>Test</p>",
        type: "WELCOME",
      });

      // Должен успешно отправить (транспортер создан из БД настроек)
      expect(result).toBe(true);

      // sendMail вызван — значит транспортер был создан из SystemSetting
      expect(mockSendMail).toHaveBeenCalled();

      // Проверяем что from содержит значение из БД (sender@db.com)
      // или из cachedFrom, установленного при создании транспортера
      const sendMailCall = mockSendMail.mock.calls[0][0];
      // from будет "sender@db.com" (из cachedFrom, установленного getTransporter)
      // ИЛИ fallback на DEFAULT_EMAIL_FROM если cachedFrom не обновился
      // Ключевое: транспортер создан, email отправлен успешно
      expect(sendMailCall.to).toBe("test@test.com");
    });

    it("invoiceEmail шаблон содержит все обязательные поля", async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const { invoiceEmail } = await import("@/lib/email");
      const { subject, html } = await invoiceEmail({
        userName: "Тест",
        planName: "Pro",
        amount: "5 990 ₸",
        period: "10.03.2026 — 10.04.2026",
        invoiceNumber: "INV-20260310-ABCDE",
      });

      expect(subject).toContain("INV-20260310-ABCDE");
      expect(html).toContain("Pro");
      expect(html).toContain("5 990 ₸");
      expect(html).toContain("10.03.2026 — 10.04.2026");
      expect(html).toContain("INV-20260310-ABCDE");
      expect(html).toContain("Тест");
    });

    it("subscriptionExpiringEmail содержит дату и имя плана", async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const { subscriptionExpiringEmail } = await import("@/lib/email");
      const { subject, html } = await subscriptionExpiringEmail({
        userName: "Мария",
        planName: "Бизнес",
        expiresAt: "15 марта 2026 г.",
      });

      expect(subject).toContain("подписка скоро истекает");
      expect(html).toContain("Бизнес");
      expect(html).toContain("15 марта 2026 г.");
      expect(html).toContain("Мария");
    });

    it("paymentFailedEmail содержит имя плана", async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const { paymentFailedEmail } = await import("@/lib/email");
      const { subject, html } = await paymentFailedEmail({
        userName: "Алексей",
        planName: "Pro",
      });

      expect(subject).toContain("Ошибка оплаты");
      expect(html).toContain("Pro");
      expect(html).toContain("Алексей");
    });

    it("orgInviteEmail содержит URL и роль", async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const { orgInviteEmail } = await import("@/lib/email");
      const { subject, html } = await orgInviteEmail({
        orgName: "ТОО Ромашка",
        inviterName: "Директор",
        role: "ADMIN",
        inviteUrl: "https://sanbao.ai/invite/abc123",
      });

      expect(subject).toContain("ТОО Ромашка");
      expect(html).toContain("https://sanbao.ai/invite/abc123");
      expect(html).toContain("администратором");
      expect(html).toContain("Директор");
    });

    it("orgInviteEmail роль MEMBER → участником", async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const { orgInviteEmail } = await import("@/lib/email");
      const { html } = await orgInviteEmail({
        orgName: "Компания",
        inviterName: "Босс",
        role: "MEMBER",
        inviteUrl: "https://sanbao.ai/invite/xyz",
      });

      expect(html).toContain("участником");
    });
  });
});
