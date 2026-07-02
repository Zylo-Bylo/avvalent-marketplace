import { describe, expect, it } from "vitest";
import {
  canAccessVendorDashboard,
  isAdminRole,
  vendorDashboardRedirect,
} from "@/lib/role-access";

describe("role access helpers", () => {
  it("identifies admin users", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("VENDOR")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it("allows vendors and admins into vendor dashboard surfaces", () => {
    expect(canAccessVendorDashboard("VENDOR")).toBe(true);
    expect(canAccessVendorDashboard("ADMIN")).toBe(true);
    expect(canAccessVendorDashboard("CUSTOMER")).toBe(false);
    expect(canAccessVendorDashboard(undefined)).toBe(false);
  });

  it("redirects guests to vendor login with the requested next path", () => {
    expect(vendorDashboardRedirect(null, "/vendor/dashboard/upload")).toBe(
      "/login?role=vendor&next=%2Fvendor%2Fdashboard%2Fupload",
    );
  });

  it("redirects customers to supplier onboarding", () => {
    expect(vendorDashboardRedirect("CUSTOMER")).toBe("/supplier");
  });

  it("does not redirect vendors or admins", () => {
    expect(vendorDashboardRedirect("VENDOR")).toBeNull();
    expect(vendorDashboardRedirect("ADMIN")).toBeNull();
  });
});
