import ProductDetailsClient from "@/components/products/ProductDetailsClient";
import { prisma } from "@/lib/prisma";
import {
  getFallbackProductById,
  getFallbackProductBySlug,
  shouldUseFallbackCatalog,
} from "@/lib/fallback-catalog";
import { normalizeCategorySizeGuide, hasSizeGuideContent } from "@/lib/category-size-guide";
import { getCategoryUploadTemplate } from "@/lib/category-upload-templates";
import { normalizeProductImageFallback } from "@/lib/product-image-fallback";
import { getProductRecommendations } from "@/lib/product-recommendations";
import type { ProductVariantRow } from "@/lib/variants";

export const dynamic = "force-dynamic";

async function getProductDetail(idOrSlug: string) {
  try {
    const product = await prisma.product.findFirst({
        where: {
          OR: [{ id: idOrSlug }, { slug: idOrSlug }],
          vendor: {
            is: {
              status: "APPROVED",
            },
          },
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          price: true,
          mrp: true,
          discountPercent: true,
          discountAmount: true,
          shippingCharge: true,
          sku: true,
          inventory: true,
          images: true,
          categoryId: true,
          subcategoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          subcategory: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          productTypeId: true,
          productType: {
            select: {
              id: true,
              name: true,
            },
          },
          vendor: {
            select: {
              id: true,
              storeName: true,
              description: true,
              logoUrl: true,
              businessCategory: true,
              _count: {
                select: {
                  products: true,
                  orders: true,
                },
              },
            },
          },
          _count: {
            select: {
              reviews: true,
            },
          },
          inventories: {
            take: 1,
            select: {
              currentStock: true,
              reservedStock: true,
              availableStock: true,
              lowStockThreshold: true,
              criticalStockThreshold: true,
              minimumOrderQuantity: true,
              maximumOrderQuantity: true,
              restockDate: true,
              stockStatus: true,
              allowBackorder: true,
              isPreOrder: true,
              bulkPricingTiers: true,
            },
          },
        },
      });

    if (!product) {
      return null;
    }

    const variants = await prisma.productVariant.findMany({
        where: { productId: product.id },
        orderBy: [{ numericSize: "asc" }, { sizeLabel: "asc" }, { color: "asc" }],
        select: {
          id: true,
          productId: true,
          sizeLabel: true,
          numericSize: true,
          color: true,
          sku: true,
          stockQuantity: true,
          price: true,
          vendorPrice: true,
          mrp: true,
          imageUrl: true,
          status: true,
          lowStockThreshold: true,
        },
      }) as ProductVariantRow[];

    return {
      ...normalizeProductImageFallback(product),
      variants,
    };
  } catch (error) {
    if (shouldUseFallbackCatalog(error)) {
      return getFallbackProductById(idOrSlug) || getFallbackProductBySlug(idOrSlug);
    }

    throw error;
  }
}

async function getProductSizeGuide(product: Awaited<ReturnType<typeof getProductDetail>>) {
  if (!product?.categoryId) return null;
  const productTypeId =
    "productTypeId" in product ? product.productTypeId : null;

  try {
    const template = await getCategoryUploadTemplate(
      product.categoryId,
      product.subcategoryId,
      productTypeId,
    );
    const sizeGuide = normalizeCategorySizeGuide(
      template?.specTemplate?.sizeGuide,
      `${product.name} ${product.category?.name || ""} ${product.subcategory?.name || ""}`,
    );
    return hasSizeGuideContent(sizeGuide) ? sizeGuide : null;
  } catch {
    return null;
  }
}

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductDetail(id);
  const [sizeGuide, recommendations] = await Promise.all([
    getProductSizeGuide(product),
    getProductRecommendations(product),
  ]);
  const serializedProduct = product
    ? JSON.parse(JSON.stringify(product))
    : null;
  const serializedSizeGuide = sizeGuide
    ? JSON.parse(JSON.stringify(sizeGuide))
    : null;
  const serializedRecommendations = JSON.parse(JSON.stringify(recommendations));

  return (
    <ProductDetailsClient
      initialProduct={serializedProduct}
      productId={serializedProduct?.id || id}
      initialSizeGuide={serializedSizeGuide}
      recommendations={serializedRecommendations}
    />
  );
}
