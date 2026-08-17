import ProductDetailsClient from "@/components/products/ProductDetailsClient";
import { prisma } from "@/lib/prisma";
import {
  getFallbackProductById,
  shouldUseFallbackCatalog,
} from "@/lib/fallback-catalog";
import type { ProductVariantRow } from "@/lib/variants";

export const dynamic = "force-dynamic";

async function getProductDetail(id: string) {
  try {
    const [product, variants] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
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
      }),
      prisma.productVariant.findMany({
        where: { productId: id },
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
      }) as Promise<ProductVariantRow[]>,
    ]);

    if (!product) {
      return null;
    }

    return {
      ...product,
      variants,
    };
  } catch (error) {
    if (shouldUseFallbackCatalog(error)) {
      return getFallbackProductById(id);
    }

    throw error;
  }
}

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductDetail(id);
  const serializedProduct = product
    ? JSON.parse(JSON.stringify(product))
    : null;

  return <ProductDetailsClient initialProduct={serializedProduct} productId={id} />;
}
