import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin-auth";
import { getAdminWarehouse, updateAdminWarehouseStatus } from "@/lib/warehouse";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ warehouseId: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  try {
    const { warehouseId } = await params;
    const warehouse = await getAdminWarehouse(warehouseId);
    return NextResponse.json({ warehouse });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Warehouse not found." },
      { status: 404 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ warehouseId: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  try {
    const { warehouseId } = await params;
    const body = await request.json().catch(() => ({}));
    const warehouse = await updateAdminWarehouseStatus({
      warehouseId,
      status: body.status,
      isActive: body.isActive,
      notes: body.notes,
    });
    return NextResponse.json({ warehouse });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Warehouse status update failed." },
      { status: 400 },
    );
  }
}
