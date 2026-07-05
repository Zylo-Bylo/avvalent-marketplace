import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    $executeRawUnsafe: vi.fn(),
    $queryRaw: vi.fn(),
  };

  return { prisma };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { validateVariantCartStock } from "@/lib/variants";

describe("checkout variant performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips variant schema checks when cart items do not use variants", async () => {
    const result = await validateVariantCartStock([
      { id: "product-1", productId: "product-1", name: "Test Product", quantity: 1 },
    ]);

    expect(result).toEqual({ ok: true });
    expect(mocks.prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(mocks.prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
