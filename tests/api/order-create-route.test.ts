import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    order: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  return {
    getAuthSession: vi.fn(),
    verifyCheckoutAuthToken: vi.fn(),
    signOrderAccessToken: vi.fn(),
    notifyOrderPlaced: vi.fn(),
    getMarketplaceUpiId: vi.fn(),
    ensureVariantSchema: vi.fn(),
    getVariantsForProducts: vi.fn(),
    validateVariantCartStock: vi.fn(),
    validateCartStock: vi.fn(),
    reduceStockForOrder: vi.fn(),
    reserveStockForOrder: vi.fn(),
    releaseReservedStockForOrder: vi.fn(),
    prisma,
  };
});

vi.mock("razorpay", () => ({
  default: vi.fn(() => ({
    orders: {
      create: vi.fn(),
    },
  })),
}));

vi.mock("stripe", () => ({
  default: vi.fn(() => ({
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  })),
}));

vi.mock("@/lib/checkout-auth-token", () => ({
  verifyCheckoutAuthToken: mocks.verifyCheckoutAuthToken,
}));

vi.mock("@/lib/order-access-token", () => ({
  signOrderAccessToken: mocks.signOrderAccessToken,
}));

vi.mock("@/lib/order-notifications", () => ({
  notifyOrderPlaced: mocks.notifyOrderPlaced,
}));

vi.mock("@/lib/payment-settings", () => ({
  getMarketplaceUpiId: mocks.getMarketplaceUpiId,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/session-cookies", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/inventory", () => ({
  releaseReservedStockForOrder: mocks.releaseReservedStockForOrder,
  reduceStockForOrder: mocks.reduceStockForOrder,
  reserveStockForOrder: mocks.reserveStockForOrder,
  validateCartStock: mocks.validateCartStock,
}));

vi.mock("@/lib/variants", () => ({
  ensureVariantSchema: mocks.ensureVariantSchema,
  getVariantsForProducts: mocks.getVariantsForProducts,
  validateVariantCartStock: mocks.validateVariantCartStock,
}));

import { POST as createOrder } from "@/app/api/orders/create/route";

function checkoutRequest(paymentMethod: "COD" | "UPI") {
  return new Request("http://localhost/api/orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          id: "product-1",
          productId: "product-1",
          name: "Test Product",
          price: 299,
          quantity: 1,
        },
      ],
      address: "123 Market Street",
      city: "Mumbai",
      state: "Maharashtra",
      zipCode: "400001",
      phone: "9876543210",
      paymentMethod,
      termsAccepted: true,
      codTermsAccepted: paymentMethod === "COD",
      totalAmount: 299,
    }),
  });
}

async function expectFastResponse(promise: Promise<Response>) {
  const timeout = Symbol("timeout");
  const result = await Promise.race([
    promise,
    new Promise<typeof timeout>((resolve) => setTimeout(() => resolve(timeout), 100)),
  ]);

  expect(result).not.toBe(timeout);
  return result as Response;
}

describe("order creation API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getAuthSession.mockResolvedValue({
      userId: "customer-1",
      role: "CUSTOMER",
    });
    mocks.verifyCheckoutAuthToken.mockReturnValue(null);
    mocks.signOrderAccessToken.mockReturnValue("order-access-token");
    mocks.getMarketplaceUpiId.mockResolvedValue("merchant@upi");
    mocks.ensureVariantSchema.mockResolvedValue(undefined);
    mocks.getVariantsForProducts.mockResolvedValue([]);
    mocks.validateVariantCartStock.mockResolvedValue({ ok: true });
    mocks.validateCartStock.mockResolvedValue({ ok: true });
    mocks.reduceStockForOrder.mockResolvedValue(undefined);
    mocks.reserveStockForOrder.mockResolvedValue(undefined);
    mocks.notifyOrderPlaced.mockImplementation(() => new Promise(() => {}));
    mocks.prisma.user.findUnique.mockResolvedValue({
      name: "Customer One",
      email: "customer@example.com",
    });
    mocks.prisma.product.findMany.mockResolvedValue([
      {
        id: "product-1",
        vendorId: "vendor-1",
        price: 299,
        mrp: 399,
        vendorPrice: 240,
        platformCommissionAmount: 40,
        packagingCharge: 0,
        shippingCharge: 0,
        vendorPayout: 240,
        vendor: {
          id: "vendor-1",
          status: "APPROVED",
        },
      },
    ]);
    mocks.prisma.order.create.mockImplementation(async ({ data }) => ({
      id: "order-1",
      totalAmount: data.totalAmount,
      items: [],
    }));
  });

  it("returns COD confirmation without waiting for order notifications", async () => {
    const response = await expectFastResponse(createOrder(checkoutRequest("COD")));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        orderId: "order-1",
        orderPlaced: true,
        paymentMethod: "COD",
      }),
    );
    expect(mocks.reduceStockForOrder).toHaveBeenCalledWith("order-1");
    expect(mocks.notifyOrderPlaced).toHaveBeenCalledWith(["order-1"], "COD order");
  });

  it("returns UPI confirmation without waiting for order notifications", async () => {
    const response = await expectFastResponse(createOrder(checkoutRequest("UPI")));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        orderId: "order-1",
        orderPlaced: true,
        paymentMethod: "UPI",
        upiId: "merchant@upi",
      }),
    );
    expect(mocks.reserveStockForOrder).toHaveBeenCalledWith("order-1");
    expect(mocks.notifyOrderPlaced).toHaveBeenCalledWith(["order-1"], "UPI order");
  });
});
