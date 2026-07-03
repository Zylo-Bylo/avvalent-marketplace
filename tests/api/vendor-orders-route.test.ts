import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const prisma = {
    vendor: {
      findUnique: vi.fn(),
    },
    order: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };

  return {
    cookies: vi.fn(),
    verifyToken: vi.fn(),
    ensureTrustTables: vi.fn(),
    getOrderTrustSnapshot: vi.fn(),
    saveDispatchProof: vi.fn(),
    restoreStockForOrder: vi.fn(),
    syncDeliveredOrderForPayout: vi.fn(),
    prisma,
  };
});

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/auth", () => ({
  verifyToken: mocks.verifyToken,
}));

vi.mock("@/lib/trust", () => ({
  ensureTrustTables: mocks.ensureTrustTables,
  getOrderTrustSnapshot: mocks.getOrderTrustSnapshot,
  saveDispatchProof: mocks.saveDispatchProof,
}));

vi.mock("@/lib/inventory", () => ({
  restoreStockForOrder: mocks.restoreStockForOrder,
}));

vi.mock("@/lib/payouts", () => ({
  syncDeliveredOrderForPayout: mocks.syncDeliveredOrderForPayout,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET as getVendorOrders } from "@/app/api/vendor/orders/route";
import { PATCH as updateVendorOrder } from "@/app/api/vendor/orders/[id]/route";

function setAuthToken(token?: string) {
  mocks.cookies.mockResolvedValue({
    get: vi.fn(() => (token ? { value: token } : undefined)),
  });
}

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/vendor/orders/order-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(id = "order-1") {
  return { params: Promise.resolve({ id }) };
}

const order = {
  id: "order-1",
  vendorId: "vendor-1",
  status: "PAID",
  paymentMethod: "COD",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  items: [],
};

describe("vendor orders API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthToken("vendor-token");
    mocks.verifyToken.mockReturnValue({ userId: "vendor-user-1", role: "VENDOR" });
    mocks.ensureTrustTables.mockResolvedValue(undefined);
    mocks.getOrderTrustSnapshot.mockResolvedValue({
      dispatchImages: [],
      deliveryOtp: null,
      verification: null,
    });
    mocks.restoreStockForOrder.mockResolvedValue(undefined);
    mocks.saveDispatchProof.mockResolvedValue(undefined);
    mocks.syncDeliveredOrderForPayout.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated vendor order listing", async () => {
    setAuthToken(undefined);

    const response = await getVendorOrders(
      new Request("http://localhost/api/vendor/orders") as NextRequest,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("blocks pending vendors from order data", async () => {
    mocks.prisma.vendor.findUnique.mockResolvedValue({
      id: "vendor-1",
      storeName: "Vendor Store",
      status: "PENDING",
    });

    const response = await getVendorOrders(
      new Request("http://localhost/api/vendor/orders") as NextRequest,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Vendor account is pending admin approval.",
    });
    expect(mocks.prisma.order.findMany).not.toHaveBeenCalled();
  });

  it("lists only orders belonging to the approved vendor", async () => {
    mocks.prisma.vendor.findUnique.mockResolvedValue({
      id: "vendor-1",
      storeName: "Vendor Store",
      status: "APPROVED",
    });
    mocks.prisma.order.findMany.mockResolvedValue([order]);
    mocks.prisma.order.count.mockResolvedValue(1);

    const response = await getVendorOrders(
      new Request("http://localhost/api/vendor/orders?limit=25&offset=5") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vendorId: "vendor-1" },
        take: 25,
        skip: 5,
      }),
    );
    expect(mocks.prisma.order.count).toHaveBeenCalledWith({
      where: { vendorId: "vendor-1" },
    });
    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      hasMore: false,
      orders: [
        {
          id: "order-1",
          vendorId: "vendor-1",
          trust: {
            dispatchImages: [],
          },
        },
      ],
    });
  });

  it("blocks unapproved vendors from updating orders", async () => {
    mocks.prisma.vendor.findUnique.mockResolvedValue({
      id: "vendor-1",
      status: "REJECTED",
    });

    const response = await updateVendorOrder(
      patchRequest({ status: "SHIPPED" }),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Approved vendor access required",
    });
    expect(mocks.prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("hides another vendor order from update attempts", async () => {
    mocks.prisma.vendor.findUnique.mockResolvedValue({
      id: "vendor-1",
      status: "APPROVED",
    });
    mocks.prisma.order.findUnique.mockResolvedValue({
      id: "order-2",
      vendorId: "vendor-2",
      status: "PAID",
      paymentMethod: "COD",
    });

    const response = await updateVendorOrder(
      patchRequest({ status: "SHIPPED" }),
      params("order-2"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Order not found" });
    expect(mocks.prisma.order.update).not.toHaveBeenCalled();
  });

  it("rejects invalid order status transitions", async () => {
    mocks.prisma.vendor.findUnique.mockResolvedValue({
      id: "vendor-1",
      status: "APPROVED",
    });
    mocks.prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      vendorId: "vendor-1",
      status: "PAID",
      paymentMethod: "COD",
    });

    const response = await updateVendorOrder(
      patchRequest({ status: "PACKED" }),
      params(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid order status",
    });
    expect(mocks.prisma.order.update).not.toHaveBeenCalled();
  });

  it("saves courier details for the vendor's own active order", async () => {
    mocks.prisma.vendor.findUnique.mockResolvedValue({
      id: "vendor-1",
      status: "APPROVED",
    });
    mocks.prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      vendorId: "vendor-1",
      status: "PAID",
      paymentMethod: "COD",
    });
    mocks.prisma.order.update.mockResolvedValue({
      id: "order-1",
      vendorId: "vendor-1",
      status: "PAID",
      carrier: "Delhivery",
      trackingNumber: "AWB123",
      items: [],
    });

    const response = await updateVendorOrder(
      patchRequest({
        action: "SAVE_COURIER_DETAILS",
        carrier: " Delhivery ",
        trackingNumber: " AWB123 ",
      }),
      params(),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({
          carrier: "Delhivery",
          trackingNumber: "AWB123",
        }),
      }),
    );
  });
});
