import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApiUser: vi.fn(),
  ensureCategoryAtelierSchema: vi.fn(),
  ensureCategoryUploadTemplateSchema: vi.fn(),
  prisma: {
    category: {
      findMany: vi.fn(),
    },
    subcategory: {
      findMany: vi.fn(),
    },
    productType: {
      findMany: vi.fn(),
    },
    categoryAuditLog: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdminApiUser: mocks.requireAdminApiUser,
}));

vi.mock("@/lib/category-atelier-schema", () => ({
  ensureCategoryAtelierSchema: mocks.ensureCategoryAtelierSchema,
}));

vi.mock("@/lib/category-upload-templates", () => ({
  ensureCategoryUploadTemplateSchema: mocks.ensureCategoryUploadTemplateSchema,
  getCategoryUploadTemplate: vi.fn(),
  saveCategoryUploadTemplate: vi.fn(),
}));

vi.mock("@/lib/category-metadata-images", () => ({
  categoryMetadataImageFields: [
    "homepageIcon",
    "categoryImage",
    "desktopBanner",
    "mobileBanner",
  ],
  sanitizeMetadataImageUpdates: (input: unknown) => input,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET } from "@/app/api/admin/category-atelier/route";

function deny(status: 401 | 403) {
  const error = status === 401 ? "Unauthorized" : "Admin access required";
  return {
    user: null,
    response: Response.json({ error }, { status }),
  };
}

function allowAdmin() {
  return {
    user: { id: "admin-user-1", role: "ADMIN" },
    response: null,
  };
}

describe("admin category atelier API authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureCategoryAtelierSchema.mockResolvedValue(undefined);
    mocks.ensureCategoryUploadTemplateSchema.mockResolvedValue(undefined);
    mocks.prisma.category.findMany.mockResolvedValue([]);
    mocks.prisma.subcategory.findMany.mockResolvedValue([]);
    mocks.prisma.productType.findMany.mockResolvedValue([]);
    mocks.prisma.categoryAuditLog.findMany.mockResolvedValue([]);
    mocks.prisma.$queryRaw.mockResolvedValue([]);
  });

  it("denies anonymous requests before loading category management data", async () => {
    mocks.requireAdminApiUser.mockResolvedValue(deny(401));

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.ensureCategoryAtelierSchema).not.toHaveBeenCalled();
    expect(mocks.prisma.category.findMany).not.toHaveBeenCalled();
  });

  it("denies customer requests before loading category management data", async () => {
    mocks.requireAdminApiUser.mockResolvedValue(deny(403));

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Admin access required" });
    expect(mocks.ensureCategoryAtelierSchema).not.toHaveBeenCalled();
    expect(mocks.prisma.category.findMany).not.toHaveBeenCalled();
  });

  it("denies vendor requests before loading category management data", async () => {
    mocks.requireAdminApiUser.mockResolvedValue(deny(403));

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.ensureCategoryAtelierSchema).not.toHaveBeenCalled();
    expect(mocks.prisma.category.findMany).not.toHaveBeenCalled();
  });

  it("allows a mapped admin to load category management data", async () => {
    mocks.requireAdminApiUser.mockResolvedValue(allowAdmin());

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      categories: [],
      templates: [],
      auditLogs: [],
      invalidImageCleanup: [],
    });
    expect(mocks.ensureCategoryAtelierSchema).toHaveBeenCalled();
    expect(mocks.prisma.category.findMany).toHaveBeenCalled();
  });
});
