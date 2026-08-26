export type PublicCategoryNode = {
  id: string;
  name: string;
  slug: string;
  entityType: "category" | "subcategory" | "productType";
  parentId: string | null;
  categorySlug: string;
  subcategorySlug: string;
  sortOrder: number;
  status: string;
  homepageVisible: boolean;
  homepageIconUrl: string;
  categoryImageUrl: string;
  desktopBannerUrl: string;
  mobileBannerUrl: string;
  altText: string;
  children: PublicCategoryNode[];
  productTypes: PublicCategoryNode[];
};

export const categoryPlaceholderImage =
  "/product-placeholder.svg";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isRenderableCategoryImage(value: unknown) {
  return (
    typeof value === "string" &&
    Boolean(value.trim()) &&
    !/^(blob|data):/i.test(value.trim())
  );
}

function permanentUrl(value: unknown) {
  return isRenderableCategoryImage(value) ? String(value).trim() : "";
}

function sortNodes<T extends { sortOrder?: number; name?: string }>(nodes: T[]) {
  return [...nodes].sort(
    (a, b) =>
      Number(a.sortOrder || 0) - Number(b.sortOrder || 0) ||
      String(a.name || "").localeCompare(String(b.name || "")),
  );
}

type RawCategoryNode = {
  id?: string;
  name?: string;
  slug?: string;
  status?: string;
  sortOrder?: number;
  archivedAt?: string | null;
  homepageVisible?: boolean;
  homepageIcon?: string | null;
  categoryImage?: string | null;
  desktopBanner?: string | null;
  mobileBanner?: string | null;
  homepageIconUrl?: string | null;
  categoryImageUrl?: string | null;
  desktopBannerUrl?: string | null;
  mobileBannerUrl?: string | null;
  altText?: string | null;
  parentId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  subcategories?: RawCategoryNode[];
  productTypes?: RawCategoryNode[];
  children?: RawCategoryNode[];
};

function isPublicNode(node: RawCategoryNode) {
  return (
    String(node.status || "ACTIVE").toUpperCase() === "ACTIVE" &&
    !node.archivedAt &&
    node.homepageVisible !== false
  );
}

function normalizeNode(
  node: RawCategoryNode,
  entityType: PublicCategoryNode["entityType"],
  parentId: string | null,
  path: { categorySlug?: string; subcategorySlug?: string } = {},
): PublicCategoryNode | null {
  if (!node.id || !node.name || !isPublicNode(node)) return null;

  const slug = node.slug || slugify(node.name);
  const categorySlug =
    entityType === "category" ? slug : path.categorySlug || "";
  const subcategorySlug =
    entityType === "subcategory" ? slug : path.subcategorySlug || "";
  const children = sortNodes(node.subcategories || node.children || [])
    .map((child) =>
      normalizeNode(child, "subcategory", node.id || null, {
        categorySlug,
      }),
    )
    .filter((child): child is PublicCategoryNode => Boolean(child));
  const productTypes = sortNodes(node.productTypes || [])
    .map((child) =>
      normalizeNode(child, "productType", node.id || null, {
        categorySlug,
        subcategorySlug,
      }),
    )
    .filter((child): child is PublicCategoryNode => Boolean(child));

  return {
    id: node.id,
    name: node.name,
    slug,
    entityType,
    parentId: node.parentId || node.categoryId || node.subcategoryId || parentId,
    categorySlug,
    subcategorySlug,
    sortOrder: Number(node.sortOrder || 0),
    status: node.status || "ACTIVE",
    homepageVisible: node.homepageVisible !== false,
    homepageIconUrl: permanentUrl(node.homepageIconUrl || node.homepageIcon),
    categoryImageUrl: permanentUrl(node.categoryImageUrl || node.categoryImage),
    desktopBannerUrl: permanentUrl(node.desktopBannerUrl || node.desktopBanner),
    mobileBannerUrl: permanentUrl(node.mobileBannerUrl || node.mobileBanner),
    altText: node.altText || node.name,
    children,
    productTypes,
  };
}

export function normalizePublicCategoryTree(input: unknown): PublicCategoryNode[] {
  const categories = Array.isArray(input)
    ? input
    : Array.isArray((input as { categories?: unknown[] } | null)?.categories)
      ? ((input as { categories: unknown[] }).categories)
      : [];

  return sortNodes(categories as RawCategoryNode[])
    .map((category) => normalizeNode(category, "category", null))
    .filter((category): category is PublicCategoryNode => Boolean(category));
}

export function getCategorySmallImage(node: PublicCategoryNode) {
  return node.homepageIconUrl || node.categoryImageUrl || categoryPlaceholderImage;
}

export function getCategoryDesktopBanner(node: PublicCategoryNode) {
  return node.desktopBannerUrl || node.categoryImageUrl || categoryPlaceholderImage;
}

export function getCategoryMobileBanner(node: PublicCategoryNode) {
  return node.mobileBannerUrl || node.categoryImageUrl || categoryPlaceholderImage;
}

export function getCategoryHref(node: PublicCategoryNode) {
  if (node.entityType === "productType") {
    if (node.categorySlug && node.subcategorySlug) {
      return `/category/${encodeURIComponent(node.categorySlug)}/${encodeURIComponent(node.subcategorySlug)}/${encodeURIComponent(node.slug)}?productTypeId=${encodeURIComponent(node.id)}`;
    }
    return `/products?productTypeId=${encodeURIComponent(node.id)}`;
  }
  if (node.entityType === "subcategory") {
    if (node.categorySlug) {
      return `/category/${encodeURIComponent(node.categorySlug)}/${encodeURIComponent(node.slug)}?subcategoryId=${encodeURIComponent(node.id)}`;
    }
    return `/products?subcategoryId=${encodeURIComponent(node.id)}`;
  }

  const firstSubcategory = node.children[0];
  if (firstSubcategory) {
    return `/category/${encodeURIComponent(node.slug)}/${encodeURIComponent(firstSubcategory.slug)}?subcategoryId=${encodeURIComponent(firstSubcategory.id)}`;
  }

  return `/category/${encodeURIComponent(node.slug)}/${encodeURIComponent(node.slug)}?categoryId=${encodeURIComponent(node.id)}`;
}

export function findCategoryBySlug(nodes: PublicCategoryNode[], slug: string) {
  return nodes.find((node) => node.slug === slug) || nodes[0] || null;
}

export function findCategoryNodeByPath(
  nodes: PublicCategoryNode[],
  mainSlug: string,
  subSlug = "",
  partSlug = "",
) {
  const category = nodes.find((node) => node.slug === mainSlug);
  if (!category || !subSlug) return category || null;

  const subcategory = category.children.find((node) => node.slug === subSlug);
  if (!subcategory || !partSlug) return subcategory || null;

  return subcategory.productTypes.find((node) => node.slug === partSlug) || subcategory;
}

export function findCategoryNodeByAnySlug(nodes: PublicCategoryNode[], slug: string) {
  if (!slug) return null;

  for (const category of nodes) {
    if (category.slug === slug) return category;

    for (const subcategory of category.children) {
      if (subcategory.slug === slug) return subcategory;

      const productType = subcategory.productTypes.find((node) => node.slug === slug);
      if (productType) return productType;
    }
  }

  return null;
}
