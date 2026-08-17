import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin-auth";
import { listAdminVendorWarehouses } from "@/lib/warehouse";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const warehouses = await listAdminVendorWarehouses(id);
    return NextResponse.json({ warehouses });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Warehouse listing failed." },
      { status: 404 },
    );
  }
}
