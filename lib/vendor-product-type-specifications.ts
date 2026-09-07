"use client";

import { useEffect, useState } from "react";
import type { VendorSpecField } from "@/lib/vendor-specifications";

export type VendorSpecificationScope = { categoryId: string; subcategoryId: string; productTypeId: string };
export type VendorResolvedSpecTemplate = { title?: string; helpText?: string; fields: VendorSpecField[] };
export const vendorSpecificationScopeKey = (scope: VendorSpecificationScope) => JSON.stringify([scope.categoryId, scope.subcategoryId, scope.productTypeId]);

export function vendorSpecificationRequest(scope: VendorSpecificationScope) {
  const query = new URLSearchParams({ categoryId: scope.categoryId });
  if (scope.subcategoryId) query.set("subcategoryId", scope.subcategoryId);
  if (scope.productTypeId) {
    if (!scope.categoryId || !scope.subcategoryId) throw new Error("Select the Category and Subcategory for this ProductType.");
    query.set("productTypeId", scope.productTypeId);
    query.set("mode", "resolved-specifications");
  }
  return `/api/category-templates?${query.toString()}`;
}

// Only the specification projection is consumed here. Size/variant configuration
// continues to use the upload page's existing Category/Subcategory request.
export function useVendorProductTypeSpecifications(scope: VendorSpecificationScope) {
  const key = vendorSpecificationScopeKey(scope);
  const [retryVersion, setRetryVersion] = useState(0);
  const [state, setState] = useState<{ key: string; retryVersion: number; template: VendorResolvedSpecTemplate | null; loading: boolean; error: string }>({ key: "", retryVersion: 0, template: null, loading: false, error: "" });
  const { categoryId, subcategoryId, productTypeId } = scope;
  useEffect(() => {
    if (!productTypeId) return;
    let active = true;
    const controller = new AbortController();
    setState({ key, retryVersion, template: null, loading: true, error: "" });
    async function load() {
      try {
        const response = await fetch(vendorSpecificationRequest({ categoryId, subcategoryId, productTypeId }), { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.code === "PUBLISHED_SPECIFICATIONS_UNAVAILABLE"
          ? "Specifications are not ready for this ProductType. Ask the administrator to publish its parent specifications, then retry."
          : "Could not load specifications for this ProductType. Retry or select another ProductType.");
        if (!Object.prototype.hasOwnProperty.call(data, "template")) throw new Error("Invalid specification response. Please retry.");
        const template = data.template?.specTemplate ?? null;
        if (template && !Array.isArray(template.fields)) throw new Error("Invalid specification fields. Please retry.");
        if (active) setState({ key, retryVersion, template, loading: false, error: "" });
      } catch (error) {
        if (active) setState({ key, retryVersion, template: null, loading: false, error: error instanceof Error ? error.message : "Could not load specifications. Please retry." });
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [categoryId, subcategoryId, productTypeId, key, retryVersion]);
  // Hide old fields synchronously on selection changes, before effect cleanup.
  const current = state.key === key && state.retryVersion === retryVersion;
  return {
    template: productTypeId && current ? state.template : null,
    loading: Boolean(productTypeId) && (!current || state.loading),
    error: productTypeId && current ? state.error : "",
    retry: () => setRetryVersion((value) => value + 1),
  };
}
