export type UserRole = "CUSTOMER" | "VENDOR" | "ADMIN";

export function isAdminRole(role: unknown) {
  return role === "ADMIN";
}

export function canAccessVendorDashboard(role: unknown) {
  return role === "VENDOR" || role === "ADMIN";
}

export function vendorDashboardRedirect(role: unknown, nextPath = "/vendor/dashboard") {
  if (!role) {
    return `/login?role=vendor&next=${encodeURIComponent(nextPath)}`;
  }

  if (!canAccessVendorDashboard(role)) {
    return "/supplier";
  }

  return null;
}
