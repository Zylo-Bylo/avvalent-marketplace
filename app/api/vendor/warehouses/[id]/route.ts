import { NextRequest, NextResponse } from "next/server";
import { requireVendorProfile } from "@/lib/vendor-profile-phase1";
import {
  deactivateVendorWarehouse,
  isUniqueWarehouseCodeError,
  updateVendorWarehouse,
} from "@/lib/warehouse";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVendorProfile();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const warehouse = await updateVendorWarehouse(auth.vendor.id, id, body);
    return NextResponse.json({ warehouse });
  } catch (error) {
    return NextResponse.json(
      {
        error: isUniqueWarehouseCodeError(error)
          ? "Warehouse code already exists for this vendor."
          : error instanceof Error
            ? error.message
            : "Warehouse update failed.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVendorProfile();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const warehouse = await deactivateVendorWarehouse(auth.vendor.id, id);
    return NextResponse.json({ warehouse, message: "Warehouse deactivated." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Warehouse deactivation failed." },
      { status: 400 },
    );
  }
}
