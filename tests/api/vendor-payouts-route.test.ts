import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
  };

  return {
    getAuthSession: vi.fn(),
    getVendorPayoutData: vi.fn(),
    requestVendorPayout: vi.fn(),
    getVendorBankAccount: vi.fn(),
    upsertVendorBankAccount: vi.fn(),
    prisma,
  };
});

vi.mock("@/lib/session-cookies", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/payouts", () => ({
  MINIMUM_PAYOUT_AMOUNT: 500,
  getVendorPayoutData: mocks.getVendorPayoutData,
  requestVendorPayout: mocks.requestVendorPayout,
  getVendorBankAccount: mocks.getVendorBankAccount,
  upsertVendorBankAccount: mocks.upsertVendorBankAccount,
}));

import {
  GET as getPayouts,
  POST as requestPayout,
} from "@/app/api/vendor/payouts/route";
import {
  GET as getBank,
  POST as saveBank,
} from "@/app/api/vendor/payouts/bank/route";

function jsonRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/vendor/payouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setVendor(status = "APPROVED") {
  mocks.getAuthSession.mockResolvedValue({
    userId: "vendor-user-1",
    role: "VENDOR",
  });
  mocks.prisma.user.findUnique.mockResolvedValue({
    id: "vendor-user-1",
    role: "VENDOR",
    vendorProfile: {
      id: "vendor-1",
      status,
    },
  });
}

describe("vendor payouts API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setVendor();
    mocks.getVendorPayoutData.mockResolvedValue({
      wallet: { availableBalance: 1200, pendingBalance: 0, paidBalance: 500 },
      bank: null,
      payouts: [],
      ledger: [],
      reports: [],
      refunds: [],
      orders: [],
    });
    mocks.requestVendorPayout.mockResolvedValue(undefined);
    mocks.getVendorBankAccount.mockResolvedValue(null);
    mocks.upsertVendorBankAccount.mockResolvedValue({
      id: "bank-1",
      vendorId: "vendor-1",
      verificationStatus: "PENDING",
    });
  });

  it("rejects unauthenticated payout access", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await getPayouts();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.getVendorPayoutData).not.toHaveBeenCalled();
  });

  it("rejects non-vendor payout access", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "customer-1",
      role: "CUSTOMER",
      vendorProfile: null,
    });

    const response = await getPayouts();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Vendor access required",
    });
  });

  it("blocks pending vendors from payout data", async () => {
    setVendor("PENDING");

    const response = await getPayouts();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Vendor account is pending admin approval.",
    });
    expect(mocks.getVendorPayoutData).not.toHaveBeenCalled();
  });

  it("returns payout data for the approved current vendor only", async () => {
    const response = await getPayouts();

    expect(response.status).toBe(200);
    expect(mocks.getVendorPayoutData).toHaveBeenCalledWith("vendor-1");
    await expect(response.json()).resolves.toMatchObject({
      wallet: { availableBalance: 1200 },
      minimumPayoutAmount: 500,
    });
  });

  it("requests payout for the approved current vendor only", async () => {
    const response = await requestPayout(jsonRequest({ amount: 750 }));

    expect(response.status).toBe(200);
    expect(mocks.requestVendorPayout).toHaveBeenCalledWith("vendor-1", 750);
    expect(mocks.getVendorPayoutData).toHaveBeenCalledWith("vendor-1");
    await expect(response.json()).resolves.toMatchObject({
      message: "Payout request created.",
      minimumPayoutAmount: 500,
    });
  });

  it("returns payout request validation errors", async () => {
    mocks.requestVendorPayout.mockRejectedValue(new Error("Minimum payout amount is Rs. 500."));

    const response = await requestPayout(jsonRequest({ amount: 100 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Minimum payout amount is Rs. 500.",
    });
  });
});

describe("vendor payout bank API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setVendor();
    mocks.getVendorBankAccount.mockResolvedValue({
      id: "bank-1",
      vendorId: "vendor-1",
      verificationStatus: "VERIFIED",
    });
    mocks.upsertVendorBankAccount.mockResolvedValue({
      id: "bank-1",
      vendorId: "vendor-1",
      verificationStatus: "PENDING",
    });
  });

  it("blocks pending vendors from bank details", async () => {
    setVendor("REJECTED");

    const response = await getBank();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Vendor account is pending admin approval.",
    });
    expect(mocks.getVendorBankAccount).not.toHaveBeenCalled();
  });

  it("returns bank details for the approved current vendor only", async () => {
    const response = await getBank();

    expect(response.status).toBe(200);
    expect(mocks.getVendorBankAccount).toHaveBeenCalledWith("vendor-1");
    await expect(response.json()).resolves.toEqual({
      bank: {
        id: "bank-1",
        vendorId: "vendor-1",
        verificationStatus: "VERIFIED",
      },
    });
  });

  it("saves bank details for the approved current vendor only", async () => {
    const body = {
      accountHolderName: "Vendor Name",
      bankName: "State Bank",
      accountNumber: "1234567890",
      ifscCode: "SBIN0000001",
      panNumber: "ABCDE1234F",
    };

    const response = await saveBank(jsonRequest(body));

    expect(response.status).toBe(200);
    expect(mocks.upsertVendorBankAccount).toHaveBeenCalledWith("vendor-1", body);
    await expect(response.json()).resolves.toMatchObject({
      bank: {
        id: "bank-1",
        vendorId: "vendor-1",
      },
      message: "Bank details saved for admin verification.",
    });
  });

  it("returns bank validation errors", async () => {
    mocks.upsertVendorBankAccount.mockRejectedValue(
      new Error("Account holder, bank, account number, IFSC and PAN are required."),
    );

    const response = await saveBank(jsonRequest({ bankName: "" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Account holder, bank, account number, IFSC and PAN are required.",
    });
  });
});
