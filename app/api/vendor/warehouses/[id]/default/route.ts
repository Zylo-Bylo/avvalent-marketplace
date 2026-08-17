import { NextRequest, NextResponse } from "next/server";
import { requireVendorProfile } from "@/lib/vendor-profile-phase1";
import { setDefaultVendorWarehouse } from "@/lib/warehouse";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVendorProfile();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const warehouse = await setDefaultVendorWarehouse(auth.vendor.id, id);
    return NextResponse.json({ warehouse, message: "Default warehouse updated." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Default warehouse update failed." },
      { status: 400 },
    );
  }
}
