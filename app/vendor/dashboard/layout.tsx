import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { verifyToken } from "@/lib/auth";
import { vendorDashboardRedirect } from "@/lib/role-access";

export default async function VendorDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const payload = token ? verifyToken(token) : null;
  const redirectTo = vendorDashboardRedirect(
    payload && typeof payload === "object" ? payload.role : null,
  );

  if (redirectTo) {
    redirect(redirectTo);
  }

  return children;
}
