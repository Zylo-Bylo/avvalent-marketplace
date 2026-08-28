import {
  getCategoryHref,
  type PublicCategoryNode,
} from "@/lib/public-category-navigation";

export type HomepageV2Product = {
  id: string;
  name: string;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  inventory?: number | null;
  images?: string[];
  categoryId?: string | null;
  subcategoryId?: string | null;
  category?: {
    name: string;
  } | null;
  subcategory?: {
    name: string;
  } | null;
  vendor?: {
    storeName: string;
  } | null;
};

export type HomepageV2Link = {
  title: string;
  text?: string;
  href: string;
};

export type HomepageV2Rail = {
  id: string;
  title: string;
  href: string;
  products: HomepageV2Product[];
};

export const homepageV2DealShortcuts: HomepageV2Link[] = [
  {
    title: "Under Rs. 199",
    text: "Budget picks",
    href: "/products?maxPrice=199",
  },
  {
    title: "Under Rs. 499",
    text: "Everyday value",
    href: "/products?maxPrice=499",
  },
  {
    title: "Best Deals",
    text: "Live offers",
    href: "/products?offer=true",
  },
  {
    title: "New Arrivals",
    text: "Fresh uploads",
    href: "/products?sort=new",
  },
  {
    title: "Bulk Buy",
    text: "Vendor stock",
    href: "/products?bulk=true",
  },
  {
    title: "Festive Picks",
    text: "Occasion ready",
    href: "/products?search=festive",
  },
];

export function isSafeInternalRoute(href: string | null | undefined) {
  if (!href) return false;
  const value = href.trim();

  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/api/") &&
    !/[^\x20-\x7E]/.test(value)
  );
}

export function safeInternalRoute(
  href: string | null | undefined,
  fallback = "/products",
) {
  return isSafeInternalRoute(href) ? String(href).trim() : fallback;
}

export function getProductDiscountPercent(product: HomepageV2Product) {
  if (typeof product.discountPercent === "number" && product.discountPercent > 0) {
    return Math.round(product.discountPercent);
  }

  const price = Number(product.price || 0);
  const mrp = Number(product.mrp || 0);

  if (!mrp || !price || mrp <= price) {
    return 0;
  }

  return Math.max(0, Math.round(((mrp - price) / mrp) * 100));
}

export function getProductRating(productId: string) {
  const seed = productId
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return Number((3.8 + (seed % 12) / 10).toFixed(1));
}

export function getProductReviewCount(productId: string) {
  const seed = productId
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return 24 + (seed % 420);
}

export function buildDepartmentNavigation(categories: PublicCategoryNode[]) {
  return categories
    .filter((category) => category.homepageVisible !== false)
    .slice(0, 9)
    .map((category) => ({
      id: category.id,
      name: category.name,
      href: getCategoryHref(category),
      children: category.children.slice(0, 8).map((subcategory) => ({
        id: subcategory.id,
        name: subcategory.name,
        href: getCategoryHref(subcategory),
        productTypes: subcategory.productTypes.slice(0, 8).map((productType) => ({
          id: productType.id,
          name: productType.name,
          href: getCategoryHref(productType),
        })),
      })),
    }));
}

export function buildCategoryProductRails(
  categories: PublicCategoryNode[],
  products: HomepageV2Product[],
  maxRails = 4,
): HomepageV2Rail[] {
  const rails: HomepageV2Rail[] = [];

  for (const category of categories) {
    if (rails.length >= maxRails) break;

    const categoryProducts = products
      .filter((product) => {
        const categoryName = product.category?.name?.toLowerCase();
        return (
          product.categoryId === category.id ||
          categoryName === category.name.toLowerCase()
        );
      })
      .slice(0, 10);

    if (categoryProducts.length < 2) {
      continue;
    }

    rails.push({
      id: category.id,
      title: `Shop ${category.name}`,
      href: getCategoryHref(category),
      products: categoryProducts,
    });
  }

  return rails;
}

export function compactProductCardText(product: HomepageV2Product) {
  return {
    title: product.name,
    subtitle:
      product.subcategory?.name ||
      product.category?.name ||
      "Zylo-Buylo",
    discountPercent: getProductDiscountPercent(product),
    stockBadge: Number(product.inventory || 0) > 0 ? "In stock" : "Limited stock",
  };
}
