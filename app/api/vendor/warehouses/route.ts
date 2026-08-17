import { NextRequest, NextResponse } from "next/server";
import { requireVendorProfile } from "@/lib/vendor-profile-phase1";
import {
  createVendorWarehouse,
  isUniqueWarehouseCodeError,
  listVendorWarehouses,
} from "@/lib/warehouse";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireVendorProfile();
  if ("response" in auth) return auth.response;

  const warehouses = await listVendorWarehouses(auth.vendor.id);
  return NextResponse.json({ warehouses });
}

export async function POST(request: NextRequest) {
  const auth = await requireVendorProfile();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const warehouse = await createVendorWarehouse(auth.vendor.id, body);
    return NextResponse.json({ warehouse }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: isUniqueWarehouseCodeError(error)
          ? "Warehouse code already exists for this vendor."
          : error instanceof Error
            ? error.message
            : "Warehouse creation failed.",
      },
      { status: 400 },
    );
  }
}
