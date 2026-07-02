import { describe, expect, it } from "vitest";
import { hashPassword, signToken, verifyPassword, verifyToken } from "@/lib/auth";

describe("auth utilities", () => {
  it("hashes passwords and verifies the original password only", async () => {
    const hashedPassword = await hashPassword("StrongPass1!");

    expect(hashedPassword).not.toBe("StrongPass1!");
    expect(await verifyPassword("StrongPass1!", hashedPassword)).toBe(true);
    expect(await verifyPassword("WrongPass1!", hashedPassword)).toBe(false);
  });

  it("signs and verifies JWT payloads", () => {
    const token = signToken({ userId: "user-1", role: "CUSTOMER" });
    const payload = verifyToken(token);

    expect(payload).toMatchObject({
      userId: "user-1",
      role: "CUSTOMER",
    });
  });

  it("returns null for invalid JWTs", () => {
    expect(verifyToken("not-a-valid-token")).toBeNull();
  });
});
