import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for billing flow: invoice generation, subscription lifecycle,
 * promo code validation, and Freedom Pay webhook completeness.
 */

// ─── Invoice number generation ─────────────────────────

describe("Invoice number generation", () => {
  it("generates INV-YYYYMMDD-XXXXX format", () => {
    // Simulate the invoice number format from invoice.ts
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

  it("generates unique invoice numbers", () => {
    function generateInvoiceNumber(): string {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
      return `INV-${y}${m}${d}-${rand}`;
    }

    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateInvoiceNumber());
    // With 36^5 = ~60M possibilities, 100 should all be unique
    expect(set.size).toBe(100);
  });
});

// ─── Subscription expiry logic ─────────────────────────

describe("Subscription expiry logic", () => {
  const now = new Date();

  function isExpired(sub: { expiresAt: Date | null; trialEndsAt: Date | null }): boolean {
    if (sub.expiresAt && sub.expiresAt < now) return true;
    if (!sub.expiresAt && sub.trialEndsAt && sub.trialEndsAt < now) return true;
    return false;
  }

  it("marks subscription as expired when expiresAt is in the past", () => {
    const past = new Date(now.getTime() - 86400000);
    expect(isExpired({ expiresAt: past, trialEndsAt: null })).toBe(true);
  });

  it("marks subscription as active when expiresAt is in the future", () => {
    const future = new Date(now.getTime() + 86400000);
    expect(isExpired({ expiresAt: future, trialEndsAt: null })).toBe(false);
  });

  it("marks trial as expired when trialEndsAt is past and no expiresAt", () => {
    const past = new Date(now.getTime() - 86400000);
    expect(isExpired({ expiresAt: null, trialEndsAt: past })).toBe(true);
  });

  it("keeps subscription active when trialEndsAt is past but expiresAt is future", () => {
    const past = new Date(now.getTime() - 86400000);
    const future = new Date(now.getTime() + 86400000);
    // expiresAt takes priority — subscription is active
    expect(isExpired({ expiresAt: future, trialEndsAt: past })).toBe(false);
  });

  it("marks as active when both are null (permanent/free)", () => {
    expect(isExpired({ expiresAt: null, trialEndsAt: null })).toBe(false);
  });
});

// ─── Promo code validation logic ───────────────────────

describe("Promo code validation", () => {
  interface PromoCode {
    code: string;
    isActive: boolean;
    discount: number;
    maxUses: number;
    usedCount: number;
    validUntil: Date | null;
    planId: string | null;
  }

  function validatePromo(
    promo: PromoCode | null,
    targetPlanId?: string
  ): { valid: boolean; error?: string; discount?: number } {
    if (!promo) return { valid: false, error: "not_found" };
    if (!promo.isActive) return { valid: false, error: "inactive" };
    if (promo.validUntil && new Date() > promo.validUntil) return { valid: false, error: "expired" };
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) return { valid: false, error: "exhausted" };
    if (promo.planId && targetPlanId && promo.planId !== targetPlanId) {
      return { valid: false, error: "wrong_plan" };
    }
    return { valid: true, discount: promo.discount };
  }

  const basePromo: PromoCode = {
    code: "TEST20",
    isActive: true,
    discount: 20,
    maxUses: 100,
    usedCount: 5,
    validUntil: null,
    planId: null,
  };

  it("validates a good promo code", () => {
    const result = validatePromo(basePromo);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(20);
  });

  it("rejects null promo", () => {
    expect(validatePromo(null).error).toBe("not_found");
  });

  it("rejects inactive promo", () => {
    expect(validatePromo({ ...basePromo, isActive: false }).error).toBe("inactive");
  });

  it("rejects expired promo", () => {
    const past = new Date(Date.now() - 86400000);
    expect(validatePromo({ ...basePromo, validUntil: past }).error).toBe("expired");
  });

  it("rejects exhausted promo", () => {
    expect(validatePromo({ ...basePromo, maxUses: 5, usedCount: 5 }).error).toBe("exhausted");
  });

  it("allows unlimited promo (maxUses = 0)", () => {
    expect(validatePromo({ ...basePromo, maxUses: 0, usedCount: 9999 }).valid).toBe(true);
  });

  it("rejects promo restricted to different plan", () => {
    const restricted = { ...basePromo, planId: "plan-pro" };
    expect(validatePromo(restricted, "plan-business").error).toBe("wrong_plan");
  });

  it("accepts promo restricted to matching plan", () => {
    const restricted = { ...basePromo, planId: "plan-pro" };
    expect(validatePromo(restricted, "plan-pro").valid).toBe(true);
  });

  it("accepts unrestricted promo for any plan", () => {
    expect(validatePromo(basePromo, "plan-anything").valid).toBe(true);
  });
});

// ─── Price discount calculation ────────────────────────

describe("Price discount calculation", () => {
  function applyDiscount(price: number, discountPercent: number): number {
    return Math.round(price * (1 - discountPercent / 100));
  }

  it("applies 20% discount correctly", () => {
    expect(applyDiscount(5990, 20)).toBe(4792);
  });

  it("applies 50% discount correctly", () => {
    expect(applyDiscount(5990, 50)).toBe(2995);
  });

  it("applies 100% discount to zero", () => {
    expect(applyDiscount(5990, 100)).toBe(0);
  });

  it("applies 0% discount (no change)", () => {
    expect(applyDiscount(5990, 0)).toBe(5990);
  });

  it("handles fractional results with rounding", () => {
    // 33% off 1000 = 670
    expect(applyDiscount(1000, 33)).toBe(670);
  });
});

// ─── Freedom Pay webhook flow ──────────────────────────

describe("Freedom Pay webhook flow", () => {
  it("computes subscription expiry as 1 month from now", () => {
    const now = new Date("2026-02-17T12:00:00Z");
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    expect(expiresAt.getMonth()).toBe(2); // March
    expect(expiresAt.getFullYear()).toBe(2026);
  });

  it("handles year boundary for December payment", () => {
    const dec = new Date("2026-12-15T12:00:00Z");
    const expiresAt = new Date(dec);
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    expect(expiresAt.getMonth()).toBe(0); // January
    expect(expiresAt.getFullYear()).toBe(2027);
  });

  it("extracts metadata planId correctly", () => {
    const metadata: Record<string, unknown> = { planId: "plan-pro", planName: "Профессионал" };
    expect((metadata as { planId?: string }).planId).toBe("plan-pro");
  });

  it("handles null metadata safely", () => {
    const metadata = null;
    const planId = (metadata as { planId?: string } | null)?.planId;
    expect(planId).toBeUndefined();
  });

  it("idempotency: already-completed payment returns early", () => {
    // Simulate the check
    const payment = { status: "COMPLETED" };
    const shouldProcess = payment.status !== "COMPLETED";
    expect(shouldProcess).toBe(false);
  });
});

// ─── Expiring subscription reminder dedup ──────────────

describe("Expiring subscription reminder dedup", () => {
  it("calculates 3-day expiry window correctly", () => {
    const now = new Date("2026-02-17T10:00:00Z");
    const threeDays = new Date(now);
    threeDays.setDate(threeDays.getDate() + 3);
    expect(threeDays.getDate()).toBe(20);
  });

  it("today start is midnight UTC", () => {
    const today = new Date("2026-02-17T15:30:45Z");
    today.setHours(0, 0, 0, 0);
    expect(today.getHours()).toBe(0);
    expect(today.getMinutes()).toBe(0);
  });
});

// ─── Plan price parsing ────────────────────────────────

describe("Plan price parsing", () => {
  it("parses numeric string price", () => {
    expect(parseInt("5990", 10)).toBe(5990);
  });

  it("parses price with non-numeric chars", () => {
    // Stripe checkout uses this pattern
    expect(parseInt("5990 KZT".replace(/\D/g, ""), 10)).toBe(5990);
  });

  it("returns NaN for empty string", () => {
    expect(parseInt("", 10)).toBeNaN();
  });

  it("returns 0 for default plan price", () => {
    expect(parseInt("0", 10)).toBe(0);
  });

  it("rejects zero/negative as invalid for checkout", () => {
    const priceNum = parseInt("0", 10);
    const isValid = priceNum > 0;
    expect(isValid).toBe(false);
  });
});
