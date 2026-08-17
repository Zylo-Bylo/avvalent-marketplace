import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNullableString, toRequiredString } from "@/lib/vendor-profile-phase1";

export const VENDOR_WAREHOUSE_STATUSES = ["PENDING", "APPROVED", "DEACTIVATED"] as const;

type WarehouseStatus = (typeof VENDOR_WAREHOUSE_STATUSES)[number];

type WarehouseInput = {
  code?: unknown;
  name?: unknown;
  contactPerson?: unknown;
  phone?: unknown;
  email?: unknown;
  addressId?: unknown;
  capacity?: unknown;
  isDefault?: unknown;
  isActive?: unknown;
  notes?: unknown;
};

function normalizeCode(value: unknown) {
  return toRequiredString(value, "Warehouse code")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .toUpperCase();
}

function toNullableNonNegativeInteger(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${field} must be a non-negative whole number.`);
  }
  return number;
}

function parseWarehouseInput(input: WarehouseInput, options: { partial?: boolean } = {}) {
  const parsed: {
    code?: string;
    name?: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    addressId?: string | null;
    capacity?: number | null;
    isDefault?: boolean;
    isActive?: boolean;
    notes?: string | null;
  } = {};

  if (!options.partial || input.code !== undefined) parsed.code = normalizeCode(input.code);
  if (!options.partial || input.name !== undefined) parsed.name = toRequiredString(input.name, "Warehouse name");
  if (!options.partial || input.contactPerson !== undefined) parsed.contactPerson = toNullableString(input.contactPerson);
  if (!options.partial || input.phone !== undefined) parsed.phone = toNullableString(input.phone);
  if (!options.partial || input.email !== undefined) parsed.email = toNullableString(input.email);
  if (!options.partial || input.addressId !== undefined) parsed.addressId = toNullableString(input.addressId);
  if (!options.partial || input.capacity !== undefined) parsed.capacity = toNullableNonNegativeInteger(input.capacity, "Capacity");
  if (!options.partial || input.isDefault !== undefined) parsed.isDefault = Boolean(input.isDefault);
  if (!options.partial || input.isActive !== undefined) parsed.isActive = input.isActive === undefined ? true : Boolean(input.isActive);
  if (!options.partial || input.notes !== undefined) parsed.notes = toNullableString(input.notes);

  return parsed;
}

async function assertVendorAddress(vendorId: string, addressId?: string | null) {
  if (!addressId) return;

  const address = await prisma.vendorAddress.findFirst({
    where: { id: addressId, vendorId },
    select: { id: true },
  });

  if (!address) {
    throw new Error("Warehouse address not found or unauthorized.");
  }
}

export async function listVendorWarehouses(vendorId: string) {
  return prisma.vendorWarehouse.findMany({
    where: { vendorId },
    orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { createdAt: "desc" }],
    include: { address: true },
  });
}

export async function createVendorWarehouse(vendorId: string, input: WarehouseInput) {
  const data = parseWarehouseInput(input);
  await assertVendorAddress(vendorId, data.addressId);

  return prisma.$transaction(async (tx) => {
    const activeCount = await tx.vendorWarehouse.count({
      where: { vendorId, isActive: true },
    });
    const shouldBeDefault = Boolean(data.isDefault) || activeCount === 0;

    if (shouldBeDefault) {
      await tx.vendorWarehouse.updateMany({
        where: { vendorId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.vendorWarehouse.create({
      data: {
        vendorId,
        code: data.code!,
        name: data.name!,
        contactPerson: data.contactPerson,
        phone: data.phone,
        email: data.email,
        addressId: data.addressId,
        capacity: data.capacity,
        isDefault: shouldBeDefault,
        isActive: data.isActive ?? true,
        status: "PENDING",
        notes: data.notes,
      },
      include: { address: true },
    });
  });
}

export async function assertOwnWarehouse(vendorId: string, warehouseId: string) {
  const warehouse = await prisma.vendorWarehouse.findFirst({
    where: { id: warehouseId, vendorId },
    include: { address: true },
  });

  if (!warehouse) {
    throw new Error("Warehouse not found or unauthorized.");
  }

  return warehouse;
}

export async function updateVendorWarehouse(vendorId: string, warehouseId: string, input: WarehouseInput) {
  await assertOwnWarehouse(vendorId, warehouseId);
  const data = parseWarehouseInput(input, { partial: true });
  await assertVendorAddress(vendorId, data.addressId);

  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.vendorWarehouse.updateMany({
        where: { vendorId, isDefault: true, NOT: { id: warehouseId } },
        data: { isDefault: false },
      });
      data.isActive = true;
    }

    return tx.vendorWarehouse.update({
      where: { id: warehouseId },
      data: { ...data, status: "PENDING" },
      include: { address: true },
    });
  });
}

export async function setDefaultVendorWarehouse(vendorId: string, warehouseId: string) {
  const warehouse = await assertOwnWarehouse(vendorId, warehouseId);

  if (!warehouse.isActive) {
    throw new Error("Only an active warehouse can be default.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.vendorWarehouse.updateMany({
      where: { vendorId, isDefault: true },
      data: { isDefault: false },
    });

    return tx.vendorWarehouse.update({
      where: { id: warehouseId },
      data: { isDefault: true, isActive: true },
      include: { address: true },
    });
  });
}

export async function deactivateVendorWarehouse(vendorId: string, warehouseId: string) {
  const warehouse = await assertOwnWarehouse(vendorId, warehouseId);

  if (warehouse.isDefault) {
    throw new Error("Default warehouse cannot be deactivated. Set another default first.");
  }

  const activeCount = await prisma.vendorWarehouse.count({
    where: { vendorId, isActive: true },
  });

  if (activeCount <= 1 && warehouse.isActive) {
    throw new Error("At least one active warehouse is required.");
  }

  return prisma.vendorWarehouse.update({
    where: { id: warehouseId },
    data: { isActive: false, status: "DEACTIVATED", isDefault: false },
    include: { address: true },
  });
}

export async function listAdminVendorWarehouses(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true },
  });

  if (!vendor) {
    throw new Error("Vendor not found.");
  }

  return listVendorWarehouses(vendorId);
}

export async function getAdminWarehouse(warehouseId: string) {
  const warehouse = await prisma.vendorWarehouse.findUnique({
    where: { id: warehouseId },
    include: {
      address: true,
      vendor: {
        select: {
          id: true,
          storeName: true,
          status: true,
          kycStatus: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!warehouse) {
    throw new Error("Warehouse not found.");
  }

  return warehouse;
}

export async function updateAdminWarehouseStatus(input: {
  warehouseId: string;
  status?: unknown;
  isActive?: unknown;
  notes?: unknown;
}) {
  const warehouse = await getAdminWarehouse(input.warehouseId);
  const status = toNullableString(input.status);
  const notes = input.notes === undefined ? undefined : toNullableString(input.notes);

  if (status && !VENDOR_WAREHOUSE_STATUSES.includes(status as WarehouseStatus)) {
    throw new Error("Invalid warehouse status.");
  }

  if (input.isActive === false && warehouse.isDefault) {
    throw new Error("Default warehouse cannot be deactivated. Set another default first.");
  }

  const nextStatus = (status || (input.isActive === false ? "DEACTIVATED" : warehouse.status)) as WarehouseStatus;
  const nextIsActive = input.isActive === undefined ? nextStatus !== "DEACTIVATED" : Boolean(input.isActive);

  if (!nextIsActive) {
    const activeCount = await prisma.vendorWarehouse.count({
      where: { vendorId: warehouse.vendorId, isActive: true },
    });
    if (activeCount <= 1 && warehouse.isActive) {
      throw new Error("At least one active warehouse is required.");
    }
  }

  return prisma.vendorWarehouse.update({
    where: { id: input.warehouseId },
    data: {
      status: nextStatus,
      isActive: nextIsActive,
      ...(notes !== undefined ? { notes } : {}),
    },
    include: {
      address: true,
      vendor: {
        select: {
          id: true,
          storeName: true,
          status: true,
          kycStatus: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

export function isUniqueWarehouseCodeError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
