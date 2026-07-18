import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminAuthState } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authState = await getAdminAuthState();

  if (authState.status === "unauthenticated") {
    redirect("/login?next=/admin/dashboard&admin=1");
  }

  if (authState.status === "forbidden") {
    redirect("/unauthorized?area=admin");
  }

  return children;
}
