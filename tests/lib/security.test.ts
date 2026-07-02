import { describe, expect, it, vi } from "vitest";
import {
  createOtp,
  createSecureToken,
  hashToken,
  minutesFromNow,
  normalizeEmail,
  validateStrongPassword,
} from "@/lib/security";

describe("security utilities", () => {
  it("normalizes email casing and whitespace", () => {
    expect(normalizeEmail("  USER@Example.COM  ")).toBe("user@example.com");
  });

  it("reports every missing strong password requirement", () => {
    const result = validateStrongPassword("abc");

    expect(result.valid).toBe(false);
    expect(result.message).toContain("at least 8 characters");
    expect(result.message).toContain("one uppercase letter");
    expect(result.message).toContain("one number");
    expect(result.message).toContain("one special character");
  });

  it("accepts a strong password", () => {
    expect(validateStrongPassword("StrongPass1!")).toEqual({
      valid: true,
      message: "",
    });
  });

  it("creates a six digit OTP", () => {
    expect(createOtp()).toMatch(/^\d{6}$/);
  });

  it("creates and hashes secure tokens", () => {
    const token = createSecureToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("calculates a future expiry date in minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T00:00:00.000Z"));

    expect(minutesFromNow(15).toISOString()).toBe("2026-07-02T00:15:00.000Z");

    vi.useRealTimers();
  });
});
