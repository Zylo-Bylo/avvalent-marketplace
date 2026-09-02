import { prisma } from "@/lib/prisma";
import { normalizeProductImageFallback } from "@/lib/product-image-fallback";
import type { Prisma } from "@prisma/client";

export type RecommendationProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  shippingCharge?: number | null;
  inventory?: number | null;
  images: string[];
  category?: { id?: string | null; name: string } | null;
  subcategory?: { id?: string | null; name: string } | null;
  productType?: { id?: string | null; name: string } | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  productTypeId?: string | null;
  vendorId?: string | null;
  inventories?: Array<{
    availableStock: number;
    lowStockThreshold: number;
    criticalStockThreshold: number;
    stockStatus: string;
    isPreOrder: boolean;
    allowBackorder: boolean;
  }>;
};

export type ProductRecommendationGroups = {
  similarProducts: RecommendationProduct[];
  youMayAlsoLike: RecommendationProduct[];
  moreFromSeller: RecommendationProduct[];
};

type ProductSeed = {
  id: string;
  name?: string | null;
  vendorId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  productTypeId?: string | null;
  price?: number | null;
  category?: { id?: string | null; name?: string | null } | null;
  subcategory?: { id?: string | null; name?: string | null } | null;
  productType?: { id?: string | null; name?: string | null } | null;
};

const recommendationSelect = {
  id: true,
  slug: true,
  name: true,
  price: true,
  mrp: true,
  discountPercent: true,
  shippingCharge: true,
  inventory: true,
  images: true,
  categoryId: true,
  subcategoryId: true,
  productTypeId: true,
  vendorId: true,
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  subcategory: {
    select: {
      id: true,
      name: true,
    },
  },
  productType: {
    select: {
      id: true,
      name: true,
    },
  },
  inventories: {
    take: 1,
    select: {
      availableStock: true,
      lowStockThreshold: true,
      criticalStockThreshold: true,
      stockStatus: true,
      isPreOrder: true,
      allowBackorder: true,
    },
  },
} as const;

const audienceTerms = new Set([
  "men",
  "mens",
  "man",
  "male",
  "women",
  "womens",
  "woman",
  "female",
  "girls",
  "girl",
  "boys",
  "boy",
  "kids",
  "kid",
  "children",
  "child",
  "baby",
  "unisex",
]);

const productFamilies = [
  ["footwear", ["shoe", "shoes", "footwear", "sneaker", "sneakers", "sandal", "sandals", "slipper", "slippers", "boot", "boots", "loafer", "loafers", "sock", "socks"]],
  ["upperwear", ["shirt", "shirts", "tshirt", "tee", "top", "tops", "kurti", "kurtis", "blouse", "blouses", "tunic", "tunics"]],
  ["bottomwear", ["jean", "jeans", "trouser", "trousers", "pant", "pants", "legging", "leggings", "short", "shorts", "skirt", "skirts"]],
  ["ethnic", ["kurti", "kurtis", "saree", "sarees", "lehenga", "lehengas", "dupatta", "dupatta", "salwar", "suit", "suits"]],
  ["dress", ["dress", "dresses", "gown", "gowns", "jumpsuit", "jumpsuits"]],
  ["bag", ["bag", "bags", "backpack", "handbag", "purse", "wallet", "luggage"]],
  ["beauty", ["face", "wash", "cream", "oil", "serum", "lotion", "shampoo", "conditioner", "makeup", "beauty"]],
  ["homeware", ["bottle", "steel", "kitchen", "home", "decor", "cushion", "cushions", "cover", "covers", "container", "tiffin", "flask", "utensil"]],
] as const;

function serializeProduct(product: unknown): RecommendationProduct {
  return normalizeProductImageFallback(product as RecommendationProduct) as RecommendationProduct;
}

function priceBand(price: number | null | undefined) {
  const value = Number(price || 0);
  if (value <= 0) return {};
  return {
    gte: Math.max(0, Math.floor(value * 0.65)),
    lte: Math.ceil(value * 1.5),
  };
}

function textParts(product: ProductSeed | RecommendationProduct) {
  return [
    product.name,
    product.category?.name,
    product.subcategory?.name,
    product.productType?.name,
  ]
    .filter(Boolean)
    .join(" ");
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function familySet(product: ProductSeed | RecommendationProduct) {
  const tokens = new Set(tokenize(textParts(product)));
  const families = new Set<string>();
  for (const [family, terms] of productFamilies) {
    if (terms.some((term) => tokens.has(term))) families.add(family);
  }
  return families;
}

function audienceSet(product: ProductSeed | RecommendationProduct) {
  const tokens = new Set(tokenize(textParts(product)));
  return new Set(Array.from(tokens).filter((token) => audienceTerms.has(token)));
}

function intersects<T>(left: Set<T>, right: Set<T>) {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

export function hasRecommendationAffinity(seed: ProductSeed, candidate: RecommendationProduct) {
  if (seed.subcategoryId && candidate.subcategoryId === seed.subcategoryId) return true;
  if (seed.productTypeId && candidate.productTypeId === seed.productTypeId) return true;

  const seedFamilies = familySet(seed);
  const candidateFamilies = familySet(candidate);

  if (seedFamilies.size) {
    if (!candidateFamilies.size || !intersects(seedFamilies, candidateFamilies)) {
      return false;
    }
  }

  const seedAudience = audienceSet(seed);
  const candidateAudience = audienceSet(candidate);
  if (seedAudience.size && candidateAudience.size && !intersects(seedAudience, candidateAudience)) {
    return false;
  }

  if (seedFamilies.size && candidateFamilies.size) return true;
  if (seedAudience.size && candidateAudience.size && intersects(seedAudience, candidateAudience)) {
    return true;
  }

  return false;
}

function relevanceScore(seed: ProductSeed, candidate: RecommendationProduct) {
  let score = 0;
  if (seed.subcategoryId && candidate.subcategoryId === seed.subcategoryId) score += 100;
  if (seed.productTypeId && candidate.productTypeId === seed.productTypeId) score += 80;
  if (seed.categoryId && candidate.categoryId === seed.categoryId) score += 30;
  if (intersects(familySet(seed), familySet(candidate))) score += 24;
  if (intersects(audienceSet(seed), audienceSet(candidate))) score += 16;

  const seedPrice = Number(seed.price || 0);
  const candidatePrice = Number(candidate.price || 0);
  if (seedPrice > 0 && candidatePrice > 0) {
    const ratio = Math.abs(candidatePrice - seedPrice) / seedPrice;
    score += Math.max(0, 20 - Math.round(ratio * 20));
  }

  score += Math.min(10, Number(candidate.inventory || candidate.inventories?.[0]?.availableStock || 0));
  score += Math.min(8, Number(candidate.discountPercent || 0) / 5);
  return score;
}

function mergeRelevant(
  seed: ProductSeed,
  groups: RecommendationProduct[][],
  limit: number,
  excluded: Set<string>,
  options: { requireAffinity?: boolean } = {},
) {
  const result: RecommendationProduct[] = [];
  for (const group of groups) {
    const ranked = group
      .filter((item) => item.id !== seed.id && !excluded.has(item.id))
      .filter((item) => !options.requireAffinity || hasRecommendationAffinity(seed, item))
      .sort((a, b) => relevanceScore(seed, b) - relevanceScore(seed, a));

    for (const product of ranked) {
      if (excluded.has(product.id)) continue;
      excluded.add(product.id);
      result.push(product);
      if (result.length >= limit) return result;
    }
  }
  return result;
}

export async function getProductRecommendations(
  product: ProductSeed | null | undefined,
): Promise<ProductRecommendationGroups> {
  if (!product?.id) {
    return { similarProducts: [], youMayAlsoLike: [], moreFromSeller: [] };
  }

  const baseWhere: Prisma.ProductWhereInput = {
    id: { not: product.id },
    vendor: { is: { status: "APPROVED" } },
    inventory: { gt: 0 },
  };
  const orderBy = [
    { inventory: "desc" as const },
    { discountPercent: "desc" as const },
    { updatedAt: "desc" as const },
  ];
  const seed = {
    ...product,
    categoryId: product.categoryId || product.category?.id || null,
    subcategoryId: product.subcategoryId || product.subcategory?.id || null,
    productTypeId: product.productTypeId || product.productType?.id || null,
  };

  const [exactLeaf, leaf, parentCategory, seller] = await Promise.all([
    seed.subcategoryId || seed.productTypeId
      ? prisma.product.findMany({
          where: {
            ...baseWhere,
            ...(seed.subcategoryId ? { subcategoryId: seed.subcategoryId } : {}),
            ...(seed.productTypeId ? { productTypeId: seed.productTypeId } : {}),
            ...(seed.price ? { price: priceBand(seed.price) } : {}),
          },
          orderBy,
          take: 12,
          select: recommendationSelect,
        })
      : Promise.resolve([]),
    seed.subcategoryId
      ? prisma.product.findMany({
          where: {
            ...baseWhere,
            subcategoryId: seed.subcategoryId,
          },
          orderBy,
          take: 16,
          select: recommendationSelect,
        })
      : Promise.resolve([]),
    seed.categoryId
      ? prisma.product.findMany({
          where: {
            ...baseWhere,
            categoryId: seed.categoryId,
          },
          orderBy,
          take: 24,
          select: recommendationSelect,
        })
      : Promise.resolve([]),
    seed.vendorId
      ? prisma.product.findMany({
          where: {
            ...baseWhere,
            vendorId: seed.vendorId,
          },
          orderBy,
          take: 16,
          select: recommendationSelect,
        })
      : Promise.resolve([]),
  ]);

  const exactLeafProducts = exactLeaf.map(serializeProduct);
  const leafProducts = leaf.map(serializeProduct);
  const parentProducts = parentCategory.map(serializeProduct);
  const sellerProducts = seller.map(serializeProduct);
  const excluded = new Set<string>();
  const similarProducts = mergeRelevant(
    seed,
    [exactLeafProducts, leafProducts, parentProducts],
    8,
    excluded,
    { requireAffinity: true },
  );
  const youMayAlsoLike = mergeRelevant(
    seed,
    [parentProducts],
    10,
    excluded,
    { requireAffinity: true },
  );
  const moreFromSeller = mergeRelevant(
    seed,
    [
      sellerProducts.filter((item) => item.categoryId === seed.categoryId),
      sellerProducts,
    ],
    8,
    excluded,
    { requireAffinity: false },
  );

  return {
    similarProducts,
    youMayAlsoLike,
    moreFromSeller,
  };
}
