import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { verifyToken } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload || payload.role !== "ADMIN") {
    redirect("/login?next=/admin/dashboard&admin=1");
  }

  return children;
}
