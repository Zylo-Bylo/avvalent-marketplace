"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar/Navbar";
import ProductImageGallery from "@/components/products/ProductImageGallery";
import SmartSizeFinder from "@/components/products/SmartSizeFinder";
import type { CategorySizeGuide } from "@/lib/category-size-guide";
import type { ProductRecommendationGroups } from "@/lib/product-recommendations";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";

type ProductVariant = {
  id: string;
  productId: string;
  sizeLabel?: string | null;
  numericSize?: string | null;
  color?: string | null;
  sku?: string | null;
  stockQuantity: number;
  price?: number | null;
  vendorPrice?: number | null;
  mrp?: number | null;
  imageUrl?: string | null;
  status: string;
  lowStockThreshold: number;
};

type Product = {
  id: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  shippingCharge?: number | null;
  sku?: string | null;
  inventory?: number | null;
  inventories?: Array<{
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    lowStockThreshold: number;
    criticalStockThreshold: number;
    minimumOrderQuantity: number;
    maximumOrderQuantity?: number | null;
    restockDate?: string | null;
    stockStatus: string;
    allowBackorder: boolean;
    isPreOrder: boolean;
    bulkPricingTiers?: unknown;
  }>;
  variants?: ProductVariant[];
  images: string[];
  category?: {
    id?: string;
    name: string;
    slug?: string | null;
  } | null;
  subcategory?: {
    id?: string;
    name: string;
    slug?: string | null;
  } | null;
  productType?: {
    id?: string;
    name: string;
  } | null;
  vendor?: {
    id: string;
    storeName: string;
    description?: string | null;
    logoUrl?: string | null;
    businessCategory?: string | null;
    _count?: {
      products?: number;
      orders?: number;
    };
  } | null;
  _count?: {
    reviews?: number;
  };
};

type ProductDetailsClientProps = {
  initialProduct: Product | null;
  productId: string;
  initialSizeGuide?: CategorySizeGuide | null;
  recommendations?: ProductRecommendationGroups;
};

const fallbackImage = "/product-placeholder.svg";

function formatPrice(price: number) {
  return `Rs. ${Number(price || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function splitDescription(description?: string | null) {
  return (description || "")
    .split(/\n|\. /)
    .map((item) => item.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 8);
}

function parseProductDetails(description?: string | null) {
  const value = description || "";
  const [body, detailsText = ""] = value.split(/\n\nProduct details:\n/i);
  const details: Record<string, string> = {};

  detailsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) return;
      const key = line.slice(0, separatorIndex).trim();
      const detailValue = line.slice(separatorIndex + 1).trim();
      if (key && detailValue) details[key] = detailValue;
    });

  return {
    body: body || value,
    details,
  };
}

function normalizeSizeValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getVariantSizeLabel(variant: ProductVariant, fallbackSize = "") {
  return [variant.sizeLabel, variant.numericSize].filter(Boolean).join(" / ") ||
    fallbackSize ||
    "Default option";
}

function getProductSizes(product: Product, details: Record<string, string>) {
  const rawSize =
    details["Available sizes"] || details.Size || details.size || "";
  const parsedSizes = rawSize
    .split(/[,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (parsedSizes.length > 0) return parsedSizes;

  const text = `${product.name} ${product.category?.name || ""} ${product.subcategory?.name || ""}`.toLowerCase();
  const needsSize =
    /shirt|t-shirt|kurti|saree|lehenga|dress|western|men|women|kids|shoe|footwear|pant|trouser|lingerie/.test(
      text,
    );

  return needsSize ? ["S", "M", "L", "XL"] : [];
}

function getPrimaryDetailSize(product: Product, details: Record<string, string>) {
  const sizes = getProductSizes(product, details);
  return sizes[0] || details.Size || details.size || "";
}

function getProductContextText(product: Product, details: Record<string, string>) {
  return [
    product.name,
    product.category?.name,
    product.subcategory?.name,
    product.productType?.name,
    details["Product type"],
    details.Type,
    details.type,
    details.Volume,
    details.volume,
    details.Capacity,
    details.capacity,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getProductOptionLabel(product: Product, details: Record<string, string>, hasSizeGuide: boolean) {
  const text = getProductContextText(product, details);
  if (/\b(gb|tb|storage|memory|ram|rom)\b/.test(text)) return "Select Storage";
  if (/\b(ml|millilitre|milliliter|litre|liter|gram|gm|kg|pack|face wash|shampoo|cream|oil|serum|lotion|beauty)\b/.test(text)) {
    return "Select Pack Size / Volume";
  }
  if (
    hasSizeGuide ||
    /\b(shoe|shoes|footwear|shirt|shirts|t-?shirt|kurti|kurtis|saree|lehenga|dress|gown|top|tops|jean|jeans|trouser|trousers|pant|pants|kids clothing)\b/.test(
      text,
    )
  ) {
    return "Select Size";
  }
  return "Select Option";
}

type DetailRow = {
  label: string;
  value: string;
};

function normalizeDetailKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getDetailValue(details: Record<string, string>, keys: string[]) {
  const wanted = new Set(keys.map(normalizeDetailKey));
  const match = Object.entries(details).find(([key, value]) => wanted.has(normalizeDetailKey(key)) && value);
  return match ? { label: match[0], value: match[1] } : null;
}

function getDetailRows(details: Record<string, string>, specs: Array<{ label: string; keys: string[] }>) {
  return specs
    .map((spec) => {
      const match = getDetailValue(details, spec.keys);
      return match ? { label: spec.label, value: match.value } : null;
    })
    .filter((row): row is DetailRow => Boolean(row));
}

function isFashionProduct(product: Product, details: Record<string, string>) {
  return /\b(apparel|fashion|clothing|women|men|kids|kurti|kurtis|shirt|shirts|t-?shirt|dress|saree|lehenga|gown|top|tops|jean|jeans|trouser|trousers|pant|pants|ethnic|wear)\b/.test(
    getProductContextText(product, details),
  );
}

function isPrivateSpecificationKey(key: string) {
  return /\b(sku|vendor price|settlement|payout|commission|bank|pan|gst|aadhaar|inventory|internal|admin|cost)\b/i.test(
    key,
  );
}

function buildSpecificationRows(
  product: Product,
  details: Record<string, string>,
  excludedKeys: Iterable<string>,
) {
  const excluded = new Set(Array.from(excludedKeys).map(normalizeDetailKey));
  const rows: DetailRow[] = [];
  const productType = product.productType?.name?.trim();

  if (productType) {
    rows.push({ label: "Product type", value: productType });
    excluded.add(normalizeDetailKey("Product type"));
  }

  Object.entries(details).forEach(([label, value]) => {
    const trimmed = String(value || "").trim();
    const normalized = normalizeDetailKey(label);
    if (!trimmed || excluded.has(normalized) || isPrivateSpecificationKey(label)) {
      return;
    }

    rows.push({ label, value: trimmed });
  });

  return rows;
}

function getSellerMetric(seed: string, min: number, range: number) {
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return min + (total % range);
}

type RecommendationItem = ProductRecommendationGroups[keyof ProductRecommendationGroups][number];

function getRecommendationContextText(product: RecommendationItem) {
  return [
    product.name,
    product.category?.name,
    product.subcategory?.name,
    product.productType?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getRecommendationCardPresentation(product: RecommendationItem) {
  const context = getRecommendationContextText(product);
  const contained = /\b(beauty|face wash|cream|serum|lotion|oil|shampoo|electronics|mobile|phone|laptop|home|living|decor|appliance)\b/.test(
    context,
  );
  const fashion = /\b(apparel|fashion|clothing|women|men|kids|kurti|kurtis|shirt|shirts|t-?shirt|dress|saree|lehenga|gown|top|tops|jean|jeans|trouser|trousers|pant|pants|ethnic|wear|shoe|shoes|footwear|bag|bags|jewellery|jewelry)\b/.test(
    context,
  );

  if (contained) {
    return {
      imageFrameClass: "aspect-[5/6]",
      imageClassName: "object-contain p-3",
      categoryLabel: product.productType?.name || product.subcategory?.name || product.category?.name || "",
    };
  }

  return {
    imageFrameClass: fashion ? "aspect-[4/5]" : "aspect-[5/6]",
    imageClassName: fashion ? "object-cover object-top" : "object-contain p-2",
    categoryLabel: product.productType?.name || product.subcategory?.name || product.category?.name || "",
  };
}

function RecommendationCard({
  product,
}: {
  product: RecommendationItem;
}) {
  const [imageSrc, setImageSrc] = useState(product.images?.[0] || fallbackImage);
  const presentation = getRecommendationCardPresentation(product);
  const hasDeal = Boolean(product.mrp && product.mrp > product.price);
  const discount =
    hasDeal && product.mrp
      ? Math.round(((Number(product.mrp) - Number(product.price)) / Number(product.mrp)) * 100)
      : Number(product.discountPercent || 0);

  return (
    <Link
      href={`/products/${product.slug || product.id}`}
      className="group block overflow-hidden rounded-2xl border border-[#eadfce] bg-white transition hover:-translate-y-0.5 hover:border-[#b88935] hover:shadow-sm"
    >
      <div className={`relative overflow-hidden bg-[#fffaf1] ${presentation.imageFrameClass}`}>
        <Image
          src={imageSrc}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 64vw, (max-width: 768px) 42vw, (max-width: 1280px) 28vw, 22vw"
          className={`${presentation.imageClassName} transition duration-300 group-hover:scale-[1.025]`}
          onError={() => {
            if (imageSrc !== fallbackImage) setImageSrc(fallbackImage);
          }}
        />
        <span
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-sm text-[#2a241d] shadow-sm ring-1 ring-[#eadfce]"
          aria-hidden="true"
        >
          ♥
        </span>
        {hasDeal && (
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-green-700 shadow-sm">
            {discount}% off
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        {presentation.categoryLabel && (
          <p className="line-clamp-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9b7a2f]">
            {presentation.categoryLabel}
          </p>
        )}
        <p className="line-clamp-2 min-h-9 text-xs font-medium leading-[18px] text-[#2a241d]">
          {product.name}
        </p>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-[#1f1b16]">{formatPrice(Number(product.price || 0))}</span>
          {hasDeal && (
            <span className="text-xs text-[#8b8071] line-through">
              {formatPrice(Number(product.mrp || 0))}
            </span>
          )}
        </div>
        <p className="text-[11px] text-green-700">★ 4.3</p>
      </div>
    </Link>
  );
}

function DetailTabRow({
  tabs,
}: {
  tabs: Array<{ id: string; label: string; href: string }>;
}) {
  if (!tabs.length) return null;

  return (
    <nav
      className="mt-8 flex gap-2 overflow-x-auto rounded-2xl border border-[#eadfce] bg-white p-2 shadow-sm"
      aria-label="Product information sections"
    >
      {tabs.map((tab, index) => (
        <a
          key={tab.id}
          href={tab.href}
          className={`flex-none rounded-xl px-4 py-2 text-sm font-medium transition ${
            index === 0
              ? "bg-[#fff4d8] text-[#6b551d]"
              : "text-[#4a4035] hover:bg-[#fffaf1]"
          }`}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}

function DetailDefinitionList({ rows }: { rows: DetailRow[] }) {
  if (!rows.length) return null;

  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm text-[#4a4035] sm:grid-cols-2">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="border-b border-[#eadfce] pb-3 last:border-b-0 sm:last:border-b">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b7a2f]">
            {row.label}
          </dt>
          <dd className="mt-1 leading-6 text-[#2a241d]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProductInfoSection({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 border-b border-[#eadfce] px-5 py-5 last:border-b-0 sm:px-6">
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9b7a2f]">
          {eyebrow}
        </p>
      )}
      <h2 className="text-lg font-semibold text-[#1f1b16]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RecommendationRail({
  title,
  products,
}: {
  title: string;
  products: ProductRecommendationGroups[keyof ProductRecommendationGroups];
}) {
  if (!products.length) return null;
  const desktopGridClass =
    products.length === 1
      ? "md:inline-grid md:grid-cols-[minmax(220px,260px)]"
      : products.length < 4
        ? "md:inline-grid md:grid-cols-[repeat(var(--rail-count),minmax(220px,280px))]"
        : "md:grid-flow-row md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#1f1b16]">{title}</h2>
        </div>
      </div>
      <div
        className={`grid grid-flow-col auto-cols-[64vw] gap-3 overflow-x-auto pb-3 [scrollbar-width:none] sm:auto-cols-[42vw] md:gap-4 md:overflow-visible [&::-webkit-scrollbar]:hidden ${desktopGridClass}`}
        style={
          { "--rail-count": Math.min(products.length, 3) } as CSSProperties &
            Record<"--rail-count", number>
        }
      >
        {products.map((item) => (
          <RecommendationCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
}

export default function ProductDetailsClient({
  initialProduct,
  productId,
  initialSizeGuide = null,
  recommendations = {
    similarProducts: [],
    youMayAlsoLike: [],
    moreFromSeller: [],
  },
}: ProductDetailsClientProps) {
  const router = useRouter();
  const { addItem } = useCartStore();
  const { addItem: addWishlistItem, removeItem, isInWishlist } = useWishlistStore();
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadProduct() {
      if (!productId || initialProduct?.id === productId) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/products/${productId}`);
      if (!isActive) return;

      if (response.ok) {
        const data = await response.json();
        setProduct(data.product);
      }

      setLoading(false);
    }

    loadProduct();

    return () => {
      isActive = false;
    };
  }, [initialProduct?.id, productId]);

  const images = useMemo(() => {
    const baseImages = Array.isArray(product?.images) && product.images.length ? product.images : [fallbackImage];
    const variantImages =
      product?.variants
        ?.map((variant) => String(variant.imageUrl || "").trim())
        .filter(Boolean) || [];
    return Array.from(new Set([...baseImages, ...variantImages])).filter(Boolean);
  }, [product]);
  const galleryPresentationContext = useMemo(
    () =>
      [
        product?.category?.name,
        product?.subcategory?.name,
        product?.productType?.name,
      ]
        .filter(Boolean)
        .join(" "),
    [product?.category?.name, product?.productType?.name, product?.subcategory?.name],
  );

  const parsedDescription = parseProductDetails(product?.description);
  const bullets = splitDescription(parsedDescription.body);
  const categoryName = product?.subcategory?.name
    ? `${product.category?.name || "Product"} / ${product.subcategory.name}`
    : product?.category?.name || "Product";
  const inventoryRecord = product?.inventories?.[0];
  const variants = useMemo(() => product?.variants || [], [product?.variants]);
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || null;
  const hasVariants = variants.length > 0;
  const fallbackVariantSize = product ? getPrimaryDetailSize(product, parsedDescription.details) : "";

  const colorOptions = useMemo(() => {
    const colorMap = new Map<string, ProductVariant>();
    variants.forEach((variant) => {
      const color = String(variant.color || "Default").trim() || "Default";
      if (!colorMap.has(color)) {
        colorMap.set(color, variant);
      }
    });
    return Array.from(colorMap.entries()).map(([color, variant]) => ({
      color,
      variant,
      availableCount: variants
        .filter((item) => (String(item.color || "Default").trim() || "Default") === color)
        .reduce((sum, item) => sum + Number(item.stockQuantity || 0), 0),
    }));
  }, [variants]);
  const hasMeaningfulColors = colorOptions.some(
    ({ color }) => color.trim().toLowerCase() !== "default",
  );

  const sizeVariants =
    selectedColor && colorOptions.length > 0
      ? variants.filter(
          (variant) =>
            (String(variant.color || "Default").trim() || "Default") === selectedColor,
        )
      : variants;

  const sizeOptions =
    variants.length > 0
      ? sizeVariants.map((variant) => ({
          label: getVariantSizeLabel(variant, fallbackVariantSize),
          variant,
          available: Number(variant.stockQuantity || 0) > 0,
        }))
      : product
        ? getProductSizes(product, parsedDescription.details).map((size) => ({
            label: size,
            variant: null,
            available: true,
          }))
        : [];

  const stock = Number(
    selectedVariant
      ? selectedVariant.stockQuantity
      : inventoryRecord?.availableStock ?? product?.inventory ?? 0,
  );
  const minimumOrderQuantity = Math.max(1, Number(inventoryRecord?.minimumOrderQuantity || 1));
  const maximumOrderQuantity = Number(inventoryRecord?.maximumOrderQuantity || 0);
  const isPreOrder = Boolean(inventoryRecord?.isPreOrder);
  const allowBackorder = Boolean(inventoryRecord?.allowBackorder || inventoryRecord?.stockStatus === "BACKORDER");
  const inStock = stock > 0 || (!hasVariants && (isPreOrder || allowBackorder));
  const maxQuantity = inStock
    ? Math.max(
        minimumOrderQuantity,
        Math.min(maximumOrderQuantity || stock || 10, stock || maximumOrderQuantity || 10),
      )
    : minimumOrderQuantity;
  const stockBadge =
    isPreOrder
      ? { label: "Pre Order Available", className: "bg-blue-100 text-blue-800" }
      : allowBackorder
        ? { label: "Backorder Available", className: "bg-blue-100 text-blue-800" }
        : stock <= 0
          ? { label: "Out of Stock", className: "bg-stone-200 text-stone-800" }
          : stock <= Number(inventoryRecord?.criticalStockThreshold ?? 3)
            ? { label: `Only ${stock} left`, className: "bg-red-100 text-red-800" }
            : stock <= Number(inventoryRecord?.lowStockThreshold ?? 10)
              ? { label: `Only ${stock} left`, className: "bg-orange-100 text-orange-800" }
              : { label: "In Stock", className: "bg-green-100 text-green-800" };
  const wishlistActive = product ? isInWishlist(product.id) : false;
  const currentPrice = Number(selectedVariant?.price || product?.price || 0);
  const currentMrp = Number(selectedVariant?.mrp || product?.mrp || 0);
  const currentDiscount =
    currentMrp > currentPrice
      ? Math.round(((currentMrp - currentPrice) / currentMrp) * 100)
      : Number(product?.discountPercent || 0);
  const currentHasDeal = Boolean(currentMrp && currentMrp > currentPrice);
  const reviewCount = product?._count?.reviews || getSellerMetric(product?.id || "product", 12, 180);
  const hasConfiguredSizeGuide = Boolean(initialSizeGuide?.fields?.length && initialSizeGuide.rows.length);
  const optionLabel = product
    ? getProductOptionLabel(product, parsedDescription.details, hasConfiguredSizeGuide)
    : "Select Option";
  const fashionProduct = product ? isFashionProduct(product, parsedDescription.details) : false;
  const materialFitRows = fashionProduct
    ? getDetailRows(parsedDescription.details, [
        { label: "Fit", keys: ["Fit", "Fit type", "Fit notes"] },
        { label: "Neckline", keys: ["Neckline", "Neck"] },
        { label: "Sleeve", keys: ["Sleeve", "Sleeve length"] },
        { label: "Garment length", keys: ["Length", "Kurti length", "Shirt length", "Top length"] },
        { label: "Silhouette", keys: ["Silhouette", "Shape"] },
        { label: "Stretch", keys: ["Stretch"] },
        { label: "Style", keys: ["Style"] },
        { label: "Pattern", keys: ["Pattern", "Print"] },
        { label: "Occasion", keys: ["Occasion"] },
      ])
    : [];
  const fabricRows = fashionProduct
    ? getDetailRows(parsedDescription.details, [
        { label: "Fabric", keys: ["Fabric", "Fabric type"] },
        { label: "Composition", keys: ["Composition", "Material composition"] },
        { label: "Material", keys: ["Material"] },
      ])
    : [];
  const careRows = getDetailRows(parsedDescription.details, [
    { label: "Care", keys: ["Care", "Care instructions", "Wash care", "Washing instructions"] },
  ]);
  const sizeFitRows: DetailRow[] = [
    sizeOptions.length > 0
      ? { label: "Available options", value: sizeOptions.map((option) => option.label).join(", ") }
      : null,
    hasConfiguredSizeGuide
      ? { label: "Guide", value: initialSizeGuide?.guideName || "Category size guide" }
      : null,
  ].filter((row): row is DetailRow => Boolean(row));
  const deliveryReturnRows: DetailRow[] = [
    product?.shippingCharge != null
      ? {
          label: "Delivery",
          value: product.shippingCharge > 0
            ? `${formatPrice(product.shippingCharge)} shipping`
            : "No additional shipping charge",
        }
      : null,
    parsedDescription.details["Return policy"]
      ? { label: "Returns", value: parsedDescription.details["Return policy"] }
      : null,
  ].filter((row): row is DetailRow => Boolean(row));
  const sellerInfoRows: DetailRow[] = product?.vendor
    ? [
        { label: "Store", value: product.vendor.storeName || "Zylo-Buylo vendor" },
        product.vendor.businessCategory
          ? { label: "Category", value: product.vendor.businessCategory }
          : null,
        product.vendor.description
          ? { label: "About seller", value: product.vendor.description }
          : null,
      ].filter((row): row is DetailRow => Boolean(row))
    : [];
  const specificationRows = product
    ? buildSpecificationRows(product, parsedDescription.details, [
        "Available sizes",
        "Brand size mapping",
        "Care",
        "Care instructions",
        "Wash care",
        "Washing instructions",
        "Compatibility / fitment",
        "Composition",
        "Fabric",
        "Fabric type",
        "Fit",
        "Fit type",
        "Fit notes",
        "Kurti length",
        "Length",
        "Material",
        "Material composition",
        "Neck",
        "Neckline",
        "Occasion",
        "Pattern",
        "Print",
        "Return policy",
        "Shape",
        "Shirt length",
        "Silhouette",
        "Sleeve",
        "Sleeve length",
        "Stretch",
        "Style",
        "Top length",
      ])
    : [];
  const detailTabs = [
    bullets.length > 0 ? { id: "details", label: "Product Details", href: "#lower-product-details" } : null,
    materialFitRows.length > 0 ? { id: "material-fit", label: "Material & Fit", href: "#lower-material-fit" } : null,
    fabricRows.length > 0 ? { id: "fabric", label: "Fabric", href: "#lower-fabric-composition" } : null,
    specificationRows.length > 0 ? { id: "specifications", label: "Specifications", href: "#lower-specifications" } : null,
    careRows.length > 0 ? { id: "care", label: "Care", href: "#lower-care" } : null,
    sizeFitRows.length > 0 ? { id: "size-fit", label: "Size & Fit", href: "#lower-size-fit" } : null,
    deliveryReturnRows.length > 0 ? { id: "delivery", label: "Delivery & Returns", href: "#lower-delivery-returns" } : null,
    sellerInfoRows.length > 0 ? { id: "seller", label: "Seller Info", href: "#lower-seller-info" } : null,
  ].filter((tab): tab is { id: string; label: string; href: string } => Boolean(tab));

  useEffect(() => {
    if (!hasVariants || selectedColor || colorOptions.length === 0) return;
    setSelectedColor(colorOptions[0].color);
  }, [colorOptions, hasVariants, selectedColor]);

  function selectSize(size: string) {
    setSelectedSize(size);
    if (!hasVariants) return;
    const normalizedSize = normalizeSizeValue(size);
    const matchingVariant = sizeVariants.find(
      (variant) =>
        normalizeSizeValue(getVariantSizeLabel(variant, fallbackVariantSize)) === normalizedSize &&
        Number(variant.stockQuantity || 0) > 0,
    );
    if (matchingVariant) {
      setSelectedVariantId(matchingVariant.id);
      setSelectedColor(String(matchingVariant.color || "Default").trim() || "Default");
      if (matchingVariant.imageUrl) {
        const imageIndex = images.findIndex((image) => image === matchingVariant.imageUrl);
        if (imageIndex >= 0) setSelectedImage(imageIndex);
      }
    }
  }

  function addProductToCart(goToCheckout = false) {
    if (!product || !inStock) return;

    if (hasVariants && !selectedVariant) {
      setAddedMessage("Please select a size or option before adding this product.");
      window.setTimeout(() => setAddedMessage(""), 2500);
      return;
    }

    const safeQuantity = Math.max(minimumOrderQuantity, quantity);
    for (let index = 0; index < safeQuantity; index += 1) {
      addItem({
        id: product.id,
        productId: product.id,
        variantId: selectedVariant?.id || null,
        sizeLabel: selectedVariant?.sizeLabel || selectedSize || fallbackVariantSize || null,
        numericSize: selectedVariant?.numericSize || null,
        color: selectedVariant?.color || parsedDescription.details.Color || null,
        sku: selectedVariant?.sku || product.sku || null,
        name: product.name,
        category: categoryName,
        price: Number(selectedVariant?.price || product.price),
        mrp: selectedVariant?.mrp || product.mrp || undefined,
        discountPercent: product.discountPercent || undefined,
        shippingCharge: product.shippingCharge || undefined,
        image: images[0],
      });
    }

    if (goToCheckout) {
      router.push("/checkout");
      return;
    }

    setAddedMessage(`${safeQuantity} item${safeQuantity > 1 ? "s" : ""} added to cart.`);
    window.setTimeout(() => setAddedMessage(""), 2500);
  }

  function toggleWishlist() {
    if (!product) return;

    if (wishlistActive) {
      removeItem(product.id);
      return;
    }

    addWishlistItem({
      id: product.id,
      name: product.name,
      category: categoryName,
      price: Number(product.price),
      mrp: product.mrp || undefined,
      discountPercent: product.discountPercent || undefined,
      shippingCharge: product.shippingCharge || undefined,
      image: images[0],
    });
  }

  if (loading || !product) {
    return (
      <main className="min-h-screen bg-[#f7f0e6]">
        <Navbar />
        <div className="mx-auto max-w-6xl p-6">
          <div className="rounded-2xl bg-white p-10 text-center text-[#6f6659] shadow-sm">
            {loading ? "Loading product..." : "Product not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f0e6] text-[#1f1b16]">
      <Navbar />

      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <nav className="mb-4 text-xs text-[#7a6b59] sm:text-sm" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-[#1f1b16]">Home</Link>
          <span> / </span>
          <span>{categoryName}</span>
          <span> / </span>
          <span className="text-[#1f1b16]">{product.name}</span>
        </nav>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(330px,380px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,400px)]">
          <ProductImageGallery
            images={images}
            productName={product.name}
            selectedIndex={selectedImage}
            onSelect={setSelectedImage}
            presentationContext={galleryPresentationContext}
          />

          <aside className="rounded-3xl bg-white shadow-sm ring-1 ring-[#eadfce] xl:sticky xl:top-28 xl:self-start">
            <section className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9b7a2f]">
                    {product.vendor?.storeName || "Zylo-Buylo seller"}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold leading-snug text-[#1f1b16] sm:text-[1.7rem]">
                    {product.name}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={toggleWishlist}
                  className={`grid h-11 w-11 flex-none place-items-center rounded-full border text-xl transition ${
                    wishlistActive
                      ? "border-[#b88935] bg-[#fff4d8] text-[#8a641c]"
                      : "border-[#eadfce] bg-white text-[#4a4035] hover:border-[#b88935]"
                  }`}
                  aria-label={wishlistActive ? "Remove from wishlist" : "Add to wishlist"}
                >
                  ♥
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#6f6659]">
                <span className="rounded-full bg-[#1f1b16] px-2.5 py-1 font-medium text-white">
                  4.3 rating
                </span>
                <span>{reviewCount} reviews</span>
                <span>Verified listing</span>
              </div>

              <div className="mt-5 border-y border-[#eadfce] py-4">
                <div className="flex flex-wrap items-end gap-2.5">
                  <p className="text-3xl font-semibold leading-none text-[#1f1b16]">
                    {formatPrice(currentPrice)}
                  </p>
                  {currentHasDeal && (
                    <>
                      <p className="text-sm text-[#8b8071] line-through">
                        {formatPrice(currentMrp)}
                      </p>
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                        {currentDiscount}% off
                      </span>
                    </>
                  )}
                </div>
                {currentHasDeal && (
                  <p className="mt-2 text-xs font-medium text-green-700">
                    You save {formatPrice(currentMrp - currentPrice)}
                  </p>
                )}
                <p className="mt-1 text-xs text-[#6f6659]">
                  Inclusive of taxes. Delivery {product.shippingCharge ? `${formatPrice(product.shippingCharge)} included` : "included"}.
                </p>
              </div>

              {hasVariants && hasMeaningfulColors && colorOptions.length > 0 && (
                <div className="border-b border-[#eadfce] py-4">
                  <div>
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1f1b16]">Select Color</h2>
                    <p className="mt-1 text-xs text-[#6f6659]">
                      {selectedColor ? `Selected: ${selectedColor}` : "Choose a color"}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {colorOptions.map(({ color, variant, availableCount }) => {
                      const isSelected = selectedColor === color;
                      const disabled = availableCount <= 0;
                      return (
                        <button
                          key={color}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (disabled) return;
                            setSelectedColor(color);
                            if (variant.imageUrl) {
                              const variantImageIndex = images.findIndex((image) => image === variant.imageUrl);
                              if (variantImageIndex >= 0) setSelectedImage(variantImageIndex);
                            }
                            if (
                              selectedVariant &&
                              (String(selectedVariant.color || "Default").trim() || "Default") !== color
                            ) {
                              setSelectedVariantId("");
                              setSelectedSize("");
                            }
                          }}
                          className={`group flex items-center gap-2 rounded-full border bg-white p-1 pr-2.5 text-left transition ${
                            disabled
                              ? "cursor-not-allowed border-[#eadfce] opacity-50"
                              : isSelected
                                ? "border-[#9b7a2f] ring-2 ring-[#e6d3a5]"
                                : "border-[#eadfce] hover:border-[#9b7a2f]"
                          }`}
                          aria-label={`Select color ${color}`}
                        >
                          <span className="relative h-8 w-8 overflow-hidden rounded-full bg-[#fffaf1]">
                            <Image
                              src={variant.imageUrl || images[0] || fallbackImage}
                              alt=""
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          </span>
                          <span className="max-w-20 truncate text-xs font-medium text-[#2a241d]">{color}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {sizeOptions.length > 0 && (
                <div className="border-b border-[#eadfce] py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1f1b16]">{optionLabel}</h2>
                      {selectedColor && hasVariants && (
                        <p className="mt-1 text-xs text-[#6f6659]">
                          Showing options for {selectedColor}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sizeOptions.map((option) => {
                      const isSelected =
                        selectedSize === option.label ||
                        (option.variant && selectedVariantId === option.variant.id);
                      return (
                        <button
                          key={option.variant?.id || option.label}
                          type="button"
                          onClick={() => {
                            if (!option.available) return;
                            if (option.variant) {
                              setSelectedVariantId(option.variant.id);
                              setSelectedColor(String(option.variant.color || "Default").trim() || "Default");
                            }
                            selectSize(option.label);
                          }}
                          disabled={!option.available}
                          className={`min-w-12 rounded-xl border px-3 py-2 text-sm font-medium leading-tight transition ${
                            !option.available
                              ? "cursor-not-allowed border-[#eadfce] bg-stone-100 text-stone-400"
                              : isSelected
                                ? "border-[#1f1b16] bg-[#1f1b16] text-white"
                                : "border-[#d8c7aa] text-[#2a241d] hover:border-[#9b7a2f]"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  {hasVariants && !selectedVariant && (
                    <p className="mt-3 text-xs text-[#6f6659]">
                      Select a size or option before ordering this product.
                    </p>
                  )}
                  <SmartSizeFinder
                    sizeGuide={initialSizeGuide}
                    sizeOptions={sizeOptions.map((option) => ({
                      label: option.label,
                      available: option.available,
                    }))}
                    onSelectSize={selectSize}
                  />
                </div>
              )}

              <div className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#6f6659]">Availability</p>
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stockBadge.className}`}>
                      {stockBadge.label}
                    </span>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-[#d8c7aa] bg-[#fffaf1]">
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.max(minimumOrderQuantity, current - 1))}
                      className="h-10 w-10 text-lg font-semibold text-[#4a4035]"
                      disabled={!inStock}
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-sm font-semibold">
                      {Math.max(minimumOrderQuantity, quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                      className="h-10 w-10 text-lg font-semibold text-[#4a4035]"
                      disabled={!inStock}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>

              {inStock ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => addProductToCart(false)}
                    className="rounded-full bg-[#1f1b16] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#332b22]"
                  >
                    Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => addProductToCart(true)}
                    className="rounded-full bg-[#d6ad55] px-4 py-3 text-sm font-semibold text-[#1f1b16] transition hover:bg-[#c79a37]"
                  >
                    Buy Now
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddedMessage("We will notify you when this product is available.")}
                  className="mt-4 w-full rounded-full bg-[#1f1b16] px-5 py-3 text-sm font-semibold text-white"
                >
                  Notify Me When Available
                </button>
              )}

              {addedMessage && (
                <p className="mt-3 rounded-2xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                  {addedMessage}
                </p>
              )}

              </div>

              {currentHasDeal ? (
                <div className="border-t border-[#eadfce] py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1f1b16]">Offer</p>
                  <p className="mt-1 text-sm text-[#4a4035]">
                    {currentDiscount}% off on this listing.
                  </p>
                </div>
              ) : null}

              <div id="product-delivery" className="border-t border-[#eadfce] py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1f1b16]">Delivery</p>
                <p className="mt-1 text-sm font-medium text-[#2a241d]">
                  {product.shippingCharge ? `${formatPrice(product.shippingCharge)} shipping` : "Shipping included"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#6f6659]">
                  Standard delivery timing is shown during checkout.
                </p>
              </div>

              <div className="border-t border-[#eadfce] py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1f1b16]">Returns</p>
                <p className="mt-1 text-sm text-[#4a4035]">
                  {parsedDescription.details["Return policy"] || "Returns as per product policy."}
                </p>
              </div>

              <div id="product-seller" className="border-t border-[#eadfce] pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1f1b16]">Sold By</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#fff4d8] text-sm font-semibold text-[#8a641c]">
                    {product.vendor?.logoUrl ? (
                      <Image
                        src={product.vendor.logoUrl}
                        alt=""
                        fill
                        sizes="40px"
                        className="rounded-full object-cover"
                      />
                    ) : (
                      product.vendor?.storeName?.slice(0, 1) || "Z"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-[#1f1b16]">
                      {product.vendor?.storeName || "Zylo-Buylo vendor"}
                    </p>
                    <p className="text-xs text-[#6f6659]">
                      {product.vendor?._count?.products || 1} products
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#6f6659]">
                  {product.vendor?.description ||
                    product.vendor?.businessCategory ||
                    "Verified seller on Zylo-Buylo marketplace."}
                </p>
                {product.vendor?.id && (
                  <Link
                    href={`/shop/${product.vendor.id}`}
                    className="mt-3 inline-flex rounded-full border border-[#d6ad55] px-4 py-2 text-xs font-semibold text-[#6b551d] transition hover:bg-[#fff8e8]"
                  >
                    View Store
                  </Link>
                )}
              </div>
            </section>
          </aside>
        </section>

        <DetailTabRow tabs={detailTabs} />

        {detailTabs.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#eadfce]">
            {bullets.length > 0 && (
              <ProductInfoSection id="lower-product-details" eyebrow="Overview" title="Product Details">
                <div className="grid gap-3 text-sm leading-6 text-[#4a4035] sm:grid-cols-2">
                  {bullets.map((item) => (
                    <p key={item} className="border-l-2 border-[#d6ad55] pl-3">
                      {item}
                    </p>
                  ))}
                </div>
              </ProductInfoSection>
            )}

            {materialFitRows.length > 0 && (
              <ProductInfoSection id="lower-material-fit" eyebrow="Fashion Details" title="Material & Fit">
                <DetailDefinitionList rows={materialFitRows} />
              </ProductInfoSection>
            )}

            {fabricRows.length > 0 && (
              <ProductInfoSection id="lower-fabric-composition" eyebrow="Composition" title="Fabric">
                <DetailDefinitionList rows={fabricRows} />
              </ProductInfoSection>
            )}

            {specificationRows.length > 0 && (
              <ProductInfoSection id="lower-specifications" title="Specifications">
                <DetailDefinitionList rows={specificationRows} />
              </ProductInfoSection>
            )}

            {careRows.length > 0 && (
              <ProductInfoSection id="lower-care" title="Care Instructions">
                <DetailDefinitionList rows={careRows} />
              </ProductInfoSection>
            )}

            {sizeFitRows.length > 0 && (
              <ProductInfoSection id="lower-size-fit" title="Size & Fit">
                <DetailDefinitionList rows={sizeFitRows} />
              </ProductInfoSection>
            )}

            {deliveryReturnRows.length > 0 && (
              <ProductInfoSection id="lower-delivery-returns" title="Delivery & Returns">
                <DetailDefinitionList rows={deliveryReturnRows} />
              </ProductInfoSection>
            )}

            {sellerInfoRows.length > 0 && (
              <ProductInfoSection id="lower-seller-info" title="Seller Information">
                <DetailDefinitionList rows={sellerInfoRows} />
                {product.vendor?.id && (
                  <Link
                    href={`/shop/${product.vendor.id}`}
                    className="mt-4 inline-flex rounded-full border border-[#d6ad55] px-4 py-2 text-xs font-semibold text-[#6b551d] transition hover:bg-[#fff8e8]"
                  >
                    View Shop
                  </Link>
                )}
              </ProductInfoSection>
            )}
          </div>
        )}

        <RecommendationRail title="Similar Products" products={recommendations.similarProducts || []} />
        <RecommendationRail title="You May Also Like" products={recommendations.youMayAlsoLike || []} />
        <RecommendationRail title="More from this Seller" products={recommendations.moreFromSeller || []} />
      </div>
    </main>
  );
}
