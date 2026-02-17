import { describe, it, expect } from "vitest";
import {
  generateSignature,
  verifySignature,
  buildCallbackResponse,
} from "@/lib/freedom-pay";

describe("freedom-pay", () => {
  const SECRET = "test-secret-key";

  describe("generateSignature", () => {
    it("generates MD5 signature with sorted params", () => {
      const sig = generateSignature(
        "init_payment.php",
        {
          pg_merchant_id: "123",
          pg_amount: "5990",
          pg_description: "Test",
          pg_salt: "abc",
        },
        SECRET
      );

      // Verify it's a valid MD5 hex string
      expect(sig).toMatch(/^[a-f0-9]{32}$/);
    });

    it("produces different signatures for different params", () => {
      const sig1 = generateSignature(
        "init_payment.php",
        { pg_amount: "100", pg_salt: "a" },
        SECRET
      );
      const sig2 = generateSignature(
        "init_payment.php",
        { pg_amount: "200", pg_salt: "a" },
        SECRET
      );
      expect(sig1).not.toBe(sig2);
    });

    it("produces different signatures for different scripts", () => {
      const params = { pg_amount: "100", pg_salt: "a" };
      const sig1 = generateSignature("init_payment.php", params, SECRET);
      const sig2 = generateSignature("get_status3.php", params, SECRET);
      expect(sig1).not.toBe(sig2);
    });

    it("produces different signatures for different secrets", () => {
      const params = { pg_amount: "100", pg_salt: "a" };
      const sig1 = generateSignature("init_payment.php", params, "secret1");
      const sig2 = generateSignature("init_payment.php", params, "secret2");
      expect(sig1).not.toBe(sig2);
    });

    it("sorts params alphabetically", () => {
      const sig1 = generateSignature(
        "test.php",
        { b: "2", a: "1", c: "3" },
        SECRET
      );
      const sig2 = generateSignature(
        "test.php",
        { c: "3", a: "1", b: "2" },
        SECRET
      );
      // Same params in different order should produce same signature
      expect(sig1).toBe(sig2);
    });
  });

  describe("verifySignature", () => {
    it("verifies valid signature", () => {
      const params = { pg_amount: "100", pg_salt: "xyz" };
      const sig = generateSignature("callback", params, SECRET);

      expect(
        verifySignature("callback", { ...params, pg_sig: sig }, SECRET)
      ).toBe(true);
    });

    it("rejects invalid signature", () => {
      expect(
        verifySignature(
          "callback",
          { pg_amount: "100", pg_salt: "xyz", pg_sig: "wrong" },
          SECRET
        )
      ).toBe(false);
    });

    it("rejects missing pg_sig", () => {
      expect(
        verifySignature("callback", { pg_amount: "100" }, SECRET)
      ).toBe(false);
    });

    it("rejects tampered params", () => {
      const params = { pg_amount: "100", pg_salt: "xyz" };
      const sig = generateSignature("callback", params, SECRET);

      // Tamper with amount
      expect(
        verifySignature(
          "callback",
          { pg_amount: "999", pg_salt: "xyz", pg_sig: sig },
          SECRET
        )
      ).toBe(false);
    });
  });

  describe("buildCallbackResponse", () => {
    it("builds valid XML for ok status", () => {
      const xml = buildCallbackResponse("ok", "Payment accepted");
      expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(xml).toContain("<pg_status>ok</pg_status>");
      expect(xml).toContain("<pg_description>Payment accepted</pg_description>");
      expect(xml).toContain("<pg_salt>");
      expect(xml).toContain("<pg_sig>");
    });

    it("builds valid XML for rejected status", () => {
      const xml = buildCallbackResponse("rejected", "Out of stock");
      expect(xml).toContain("<pg_status>rejected</pg_status>");
      expect(xml).toContain("<pg_description>Out of stock</pg_description>");
    });

    it("escapes XML special characters in description", () => {
      const xml = buildCallbackResponse("ok", 'Test <script> & "quotes"');
      expect(xml).toContain("&lt;script&gt;");
      expect(xml).toContain("&amp;");
      expect(xml).toContain("&quot;quotes&quot;");
      expect(xml).not.toContain("<script>");
    });
  });
});
