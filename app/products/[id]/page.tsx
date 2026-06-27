"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar/Navbar";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";

type Product = {
  id: string;
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
  variants?: Array<{
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
  }>;
  images: string[];
  category?: {
    name: string;
  } | null;
  subcategory?: {
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

const fallbackImage = "https://placehold.co/900x900/png?text=Product";

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
    .slice(0, 6);
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
      if (separatorIndex === -1) {
        return;
      }

      const key = line.slice(0, separatorIndex).trim();
      const detailValue = line.slice(separatorIndex + 1).trim();
      if (key && detailValue) {
        details[key] = detailValue;
      }
    });

  return {
    body: body || value,
    details,
  };
}

function getProductSizes(product: Product, details: Record<string, string>) {
  const rawSize =
    details["Available sizes"] || details.Size || details.size || "";
  const parsedSizes = rawSize
    .split(/[,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (parsedSizes.length > 0) {
    return parsedSizes;
  }

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

function getSizeGuideRows(product: Product, details: Record<string, string>) {
  const text = `${product.name} ${product.category?.name || ""} ${product.subcategory?.name || ""}`.toLowerCase();
  const isFootwear = /shoe|sandal|slipper|footwear/.test(text);
  const brandMapping = details["Brand size mapping"];

  if (brandMapping) {
    return brandMapping.split(/[,|]/).map((item, index) => {
      const [indiaSize = item, ukSize = "", usSize = "", euSize = ""] = item
        .split(/[=/]/)
        .map((part) => part.trim());

      return {
        indiaSize,
        ukSize,
        usSize,
        euSize,
        chest: "",
        waist: "",
        hip: "",
        length: "",
        footLength: "",
        key: `${item}-${index}`,
      };
    });
  }

  if (isFootwear) {
    return [
      ["6", "6", "7", "40", "25 cm"],
      ["7", "7", "8", "41", "26 cm"],
      ["8", "8", "9", "42", "27 cm"],
      ["9", "9", "10", "43", "28 cm"],
      ["10", "10", "11", "44", "29 cm"],
    ].map(([indiaSize, ukSize, usSize, euSize, footLength]) => ({
      indiaSize,
      ukSize,
      usSize,
      euSize,
      chest: "",
      waist: "",
      hip: "",
      length: "",
      footLength,
      key: indiaSize,
    }));
  }

  return [
    ["S", "36", "38", "46", "36-38", "30-32", "36-38", "27"],
    ["M", "38", "40", "50", "38-40", "32-34", "38-40", "28"],
    ["L", "40", "42", "52", "40-42", "34-36", "40-42", "29"],
    ["XL", "42", "44", "54", "42-44", "36-38", "42-44", "30"],
    ["XXL", "44", "46", "56", "44-46", "38-40", "44-46", "31"],
  ].map(([indiaSize, ukSize, usSize, euSize, chest, waist, hip, length]) => ({
    indiaSize,
    ukSize,
    usSize,
    euSize,
    chest,
    waist,
    hip,
    length,
    footLength: "",
    key: indiaSize,
  }));
}

function getSellerMetric(seed: string, min: number, range: number) {
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return min + (total % range);
}

function getVariantLabel(variant: NonNullable<Product["variants"]>[number]) {
  return [variant.sizeLabel, variant.numericSize].filter(Boolean).join(" / ") ||
    variant.color ||
    "Default";
}

function getVariantSizeLabel(
  variant: NonNullable<Product["variants"]>[number],
  fallbackSize = "",
) {
  return [variant.sizeLabel, variant.numericSize].filter(Boolean).join(" / ") ||
    fallbackSize ||
    "Default option";
}

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { addItem } = useCartStore();
  const { addItem: addWishlistItem, removeItem, isInWishlist } = useWishlistStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadProduct() {
      if (!id) {
        return;
      }

      const response = await fetch(`/api/products/${id}`);

      if (!isActive) {
        return;
      }

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
  }, [id]);

  const images = useMemo(() => {
    const baseImages = product?.images?.length ? product.images : [fallbackImage];
    const variantImages =
      product?.variants
        ?.map((variant) => String(variant.imageUrl || "").trim())
        .filter(Boolean) || [];
    return Array.from(new Set([...baseImages, ...variantImages]));
  }, [product]);
  const categoryName = product?.subcategory?.name
    ? `${product.category?.name || "Product"} / ${product.subcategory.name}`
    : product?.category?.name || "Product";
  const inventoryRecord = product?.inventories?.[0];
  const variants = product?.variants || [];
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || null;
  const hasVariants = variants.length > 0;
  const colorOptions = useMemo(() => {
    const colorMap = new Map<string, NonNullable<Product["variants"]>[number]>();
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
  const sizeVariants =
    selectedColor && colorOptions.length > 0
      ? variants.filter(
          (variant) =>
            (String(variant.color || "Default").trim() || "Default") === selectedColor,
        )
      : variants;
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
          ? { label: "Out of Stock", className: "bg-gray-200 text-gray-800" }
          : stock <= Number(inventoryRecord?.criticalStockThreshold ?? 3)
            ? { label: `Only ${stock} left - Order Soon`, className: "bg-red-100 text-red-800" }
            : stock <= Number(inventoryRecord?.lowStockThreshold ?? 10)
              ? { label: `Only ${stock} left`, className: "bg-orange-100 text-orange-800" }
              : { label: "In Stock", className: "bg-green-100 text-green-800" };
  const wishlistActive = product ? isInWishlist(product.id) : false;
  const parsedDescription = parseProductDetails(product?.description);
  const bullets = splitDescription(parsedDescription.body);
  const fallbackVariantSize = product
    ? getPrimaryDetailSize(product, parsedDescription.details)
    : "";
  const sizeOptions =
    variants.length > 0
      ? sizeVariants.map((variant) => getVariantSizeLabel(variant, fallbackVariantSize))
      : product
        ? getProductSizes(product, parsedDescription.details)
        : [];
  const sizeGuideRows = product ? getSizeGuideRows(product, parsedDescription.details) : [];
  const highlightRows = [
    ["Brand", parsedDescription.details.Brand],
    ["Color", parsedDescription.details.Color],
    ["Size", parsedDescription.details.Size],
    ["Material", parsedDescription.details.Material],
    ["Condition", parsedDescription.details.Condition],
    ["Warranty", parsedDescription.details.Warranty],
    ["Product type", parsedDescription.details["Product type"]],
    ["Fitment", parsedDescription.details["Compatibility / fitment"]],
    ["Return policy", parsedDescription.details["Return policy"]],
  ].filter(([, value]) => value);
  const hasDeal = Boolean(product?.mrp && product.mrp > product.price);
  const currentPrice = Number(selectedVariant?.price || product?.price || 0);
  const currentMrp = Number(selectedVariant?.mrp || product?.mrp || 0);
  const currentDiscount =
    currentMrp > currentPrice
      ? Math.round(((currentMrp - currentPrice) / currentMrp) * 100)
      : Number(product?.discountPercent || 0);
  const currentHasDeal = Boolean(currentMrp && currentMrp > currentPrice);
  const reviewCount = product?._count?.reviews || getSellerMetric(product?.id || "product", 12, 180);
  const sellerFollowerCount = getSellerMetric(product?.vendor?.id || product?.id || "vendor", 120, 2400);

  useEffect(() => {
    if (!hasVariants || selectedColor || colorOptions.length === 0) {
      return;
    }
    setSelectedColor(colorOptions[0].color);
  }, [colorOptions, hasVariants, selectedColor]);

  function addProductToCart(goToCheckout = false) {
    if (!product || !inStock) {
      return;
    }

    if (hasVariants && !selectedVariant) {
      setAddedMessage("Please select a size before adding this product.");
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
    if (!product) {
      return;
    }

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
      <main className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="mx-auto max-w-6xl p-6">
          <div className="rounded-lg bg-white p-10 text-center text-gray-600 shadow-sm">
            {loading ? "Loading product..." : "Product not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <Navbar />

      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-4 text-sm text-gray-500">
          Home / {categoryName} / <span className="text-gray-900">{product.name}</span>
        </div>

        <section className="grid gap-5 lg:grid-cols-[minmax(500px,560px)_minmax(360px,1fr)] xl:grid-cols-[minmax(540px,620px)_minmax(360px,1fr)_300px]">
          <div className="grid gap-4 self-start md:grid-cols-[72px_minmax(0,1fr)] lg:sticky lg:top-24">
            <div className="order-2 flex gap-3 overflow-x-auto md:order-1 md:max-h-[620px] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pr-1">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  className={`relative h-16 w-16 flex-none overflow-hidden rounded-md border bg-white p-1 transition ${
                    selectedImage === index
                      ? "border-pink-600 ring-2 ring-pink-100"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                  aria-label={`View product image ${index + 1}`}
                >
                  <Image
                    src={image || fallbackImage}
                    alt=""
                    fill
                    sizes="64px"
                    className="rounded object-contain"
                  />
                </button>
              ))}
            </div>

            <div className="order-1 bg-white p-3 shadow-sm md:order-2 md:p-5">
              <div className="group relative h-[420px] overflow-hidden bg-white sm:h-[520px] lg:h-[600px]">
                <button
                  type="button"
                  onClick={() => setIsZoomModalOpen(true)}
                  className="h-full w-full cursor-zoom-in"
                  aria-label="Open product image in full screen"
                >
                  <Image
                    src={images[selectedImage] || fallbackImage}
                    alt={product.name}
                    fill
                    priority
                    sizes="(min-width: 1280px) 620px, (min-width: 1024px) 560px, 100vw"
                    className="object-contain"
                  />
                </button>
                <div className="absolute left-3 top-3 rounded bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">
                  Trusted Vendor
                </div>
                <button
                  type="button"
                  onClick={() => setIsZoomModalOpen(true)}
                  className="absolute bottom-3 right-3 rounded bg-white px-4 py-2 text-sm font-bold text-gray-900 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
                >
                  Zoom image
                </button>
                <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/70 px-3 py-2 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
                  Click image for full view
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <section className="bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-pink-600">
                    {product.vendor?.storeName || "Zylo-Buylo seller"}
                  </p>
                  <h1 className="mt-2 text-2xl font-bold leading-tight text-gray-950 sm:text-3xl">
                    {product.name}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={toggleWishlist}
                  className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                    wishlistActive
                      ? "border-pink-600 bg-pink-50 text-pink-700"
                      : "border-gray-200 text-gray-700 hover:border-pink-300"
                  }`}
                >
                  {wishlistActive ? "Saved" : "Wishlist"}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded bg-green-600 px-2 py-1 text-sm font-bold text-white">
                  4.3 rating
                </span>
                <span className="text-sm text-gray-500">{reviewCount} reviews</span>
                <span className="text-sm text-gray-500">Verified marketplace listing</span>
                {product.sku && (
                  <span className="text-sm text-gray-500">SKU: {product.sku}</span>
                )}
              </div>

              <div className="mt-5 border-y border-gray-100 py-5">
                <div className="flex flex-wrap items-baseline gap-3">
                  <p className="text-3xl font-bold text-gray-950">
                    {formatPrice(currentPrice)}
                  </p>
                  {currentHasDeal && (
                    <>
                      <p className="text-lg text-gray-500 line-through">
                        {formatPrice(currentMrp)}
                      </p>
                      <span className="rounded bg-green-50 px-2 py-1 text-sm font-bold text-green-700">
                        {currentDiscount}% off
                      </span>
                    </>
                  )}
                </div>
                {currentHasDeal && (
                  <p className="mt-1 text-sm font-semibold text-green-700">
                    You save {formatPrice(currentMrp - currentPrice)}
                  </p>
                )}
                <p className="mt-1 text-sm text-green-700">
                  Inclusive of taxes. Delivery {product.shippingCharge ? `${formatPrice(product.shippingCharge)} included` : "included"}.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["Fast delivery", "Trackable order updates"],
                  ["Secure checkout", "Razorpay/Stripe ready"],
                  ["Easy support", "Vendor-managed listing"],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-md border border-gray-200 p-3">
                    <p className="text-sm font-bold text-gray-950">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            {hasVariants && colorOptions.length > 0 && (
              <section className="bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-950">Select Color</h2>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {selectedColor ? `Selected: ${selectedColor}` : "Choose a color to see sizes"}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-green-700">Image + price variants</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
                            const variantImageIndex = images.findIndex(
                              (image) => image === variant.imageUrl,
                            );
                            if (variantImageIndex >= 0) {
                              setSelectedImage(variantImageIndex);
                            }
                          }
                          if (
                            selectedVariant &&
                            (String(selectedVariant.color || "Default").trim() || "Default") !== color
                          ) {
                            setSelectedVariantId("");
                            setSelectedSize("");
                          }
                        }}
                        className={`rounded-lg border bg-white p-2 text-left transition ${
                          disabled
                            ? "cursor-not-allowed border-gray-200 opacity-50"
                            : isSelected
                              ? "border-pink-600 ring-2 ring-pink-100"
                              : "border-gray-200 hover:border-pink-300"
                        }`}
                      >
                        <div className="relative aspect-square overflow-hidden rounded-md bg-gray-50">
                          <Image
                            src={variant.imageUrl || images[0] || fallbackImage}
                            alt={color}
                            fill
                            sizes="160px"
                            className="object-contain"
                          />
                        </div>
                        <p className="mt-2 line-clamp-1 text-xs font-black text-gray-950">{color}</p>
                        <p className="mt-1 text-xs font-bold text-gray-700">
                          {formatPrice(Number(variant.price || product.price))}
                        </p>
                        <p className={`mt-1 text-[11px] font-bold ${availableCount > 0 ? "text-green-700" : "text-red-600"}`}>
                          {availableCount > 0 ? `${availableCount} in stock` : "Out of stock"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {sizeOptions.length > 0 && (
              <section className="bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-950">Select Size</h2>
                    {selectedColor && hasVariants && (
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        Showing sizes for {selectedColor}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSizeGuideOpen(true)}
                    className="text-sm font-bold text-pink-600"
                  >
                    Size Guide
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {hasVariants
                    ? sizeVariants.map((variant) => {
                        const disabled = Number(variant.stockQuantity || 0) <= 0;
                        const isSelected = selectedVariantId === variant.id;
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => {
                              if (disabled) return;
                              setSelectedVariantId(variant.id);
                              setSelectedSize(getVariantSizeLabel(variant, fallbackVariantSize));
                              setSelectedColor(String(variant.color || "Default").trim() || "Default");
                            }}
                            disabled={disabled}
                            className={`min-w-16 rounded-full border px-4 py-2 text-sm font-bold transition ${
                              disabled
                                ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                                : isSelected
                                  ? "border-pink-600 bg-pink-50 text-pink-700"
                                  : "border-gray-300 text-gray-800 hover:border-pink-400"
                            }`}
                          >
                            {getVariantSizeLabel(variant, fallbackVariantSize)}
                          </button>
                        );
                      })
                    : sizeOptions.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`min-w-12 rounded-full border px-4 py-2 text-sm font-bold transition ${
                            selectedSize === size
                              ? "border-pink-600 bg-pink-50 text-pink-700"
                              : "border-gray-300 text-gray-800 hover:border-pink-400"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                </div>
                {hasVariants && selectedVariant && (
                  <p className="mt-3 text-xs font-bold text-gray-700">
                    {selectedVariant.color ? `Color: ${selectedVariant.color} / ` : ""}
                    SKU: {selectedVariant.sku || "Variant SKU pending"} /{" "}
                    {selectedVariant.stockQuantity <= 0
                      ? "Out of Stock"
                      : selectedVariant.stockQuantity <= selectedVariant.lowStockThreshold
                        ? `Only ${selectedVariant.stockQuantity} left`
                        : "In Stock"}
                  </p>
                )}
                {hasVariants && !selectedVariant && (
                  <p className="mt-3 text-xs font-semibold text-gray-500">
                    Select a size before ordering if this product has size variation.
                  </p>
                )}
              </section>
            )}

            {highlightRows.length > 0 && (
              <section className="bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-950">Product Highlights</h2>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard?.writeText(
                        highlightRows.map(([label, value]) => `${label}: ${value}`).join("\n"),
                      )
                    }
                    className="text-xs font-bold text-pink-600"
                  >
                    COPY
                  </button>
                </div>
                <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  {highlightRows.slice(0, 8).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold uppercase text-gray-500">
                        {label}
                      </dt>
                      <dd className="mt-1 font-semibold text-gray-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

          </div>

          <aside className="space-y-4 self-start xl:sticky xl:top-24">
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-500">Buying options</p>
              <div className="mt-3">
                <p className="text-2xl font-bold text-gray-950">
                  {formatPrice(currentPrice)}
                </p>
                {currentHasDeal && (
                  <p className="mt-1 text-sm text-gray-500">
                    MRP <span className="line-through">{formatPrice(currentMrp)}</span>{" "}
                    <span className="font-bold text-green-700">{currentDiscount}% off</span>
                  </p>
                )}
                <p className="mt-1 text-xs font-semibold text-green-700">
                  Inclusive of taxes. Secure payment.
                </p>
              </div>

              <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-bold text-gray-950">Delivery</p>
                <p className="mt-1">
                  Trackable delivery after seller dispatch.
                </p>
                <p className="mt-1">
                  Delivery charge: <b>{product.shippingCharge ? formatPrice(product.shippingCharge) : "Included"}</b>
                </p>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-500">Availability</p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-bold ${stockBadge.className}`}>
                  {stockBadge.label}
                </span>
                <div className="mt-3 grid gap-1 text-sm text-gray-600">
                  <p>Available stock: <b>{stock}</b></p>
                  <p>Minimum order: <b>{minimumOrderQuantity}</b></p>
                  {maximumOrderQuantity > 0 && <p>Max order: <b>{maximumOrderQuantity}</b></p>}
                  {selectedVariant && (
                    <p>
                      Selected: <b>{selectedSize || getVariantSizeLabel(selectedVariant, fallbackVariantSize)}</b>
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-bold text-gray-950">Quantity</p>
                <div className="inline-flex items-center rounded-md border border-gray-200">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) => Math.max(minimumOrderQuantity, current - 1))
                    }
                    className="h-10 w-10 text-lg font-bold text-gray-700 hover:bg-gray-50"
                    disabled={!inStock}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-bold">
                    {Math.max(minimumOrderQuantity, quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) => Math.min(maxQuantity, current + 1))
                    }
                    className="h-10 w-10 text-lg font-bold text-gray-700 hover:bg-gray-50"
                    disabled={!inStock}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              {inStock ? (
                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={() => addProductToCart(true)}
                    className="rounded-full bg-[#ff9f00] px-5 py-3 text-base font-bold text-gray-950 transition hover:bg-[#f39a00]"
                  >
                    Buy Now
                  </button>
                  <button
                    type="button"
                    onClick={() => addProductToCart(false)}
                    className="rounded-full bg-[#ffd814] px-5 py-3 text-base font-bold text-gray-950 transition hover:bg-[#f7ca00]"
                  >
                    Add to Cart
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddedMessage("We will notify you when this product is available.")}
                  className="mt-4 w-full rounded-full bg-slate-900 px-5 py-3 text-base font-bold text-white transition hover:bg-slate-800"
                >
                  Notify Me When Available
                </button>
              )}

              <button
                type="button"
                onClick={toggleWishlist}
                className={`mt-3 w-full rounded-md border px-4 py-2 text-sm font-semibold transition ${
                  wishlistActive
                    ? "border-pink-600 bg-pink-50 text-pink-700"
                    : "border-gray-200 text-gray-700 hover:border-pink-300"
                }`}
              >
                {wishlistActive ? "Saved to Wishlist" : "Add to Wishlist"}
              </button>

              {addedMessage && (
                <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                  {addedMessage}
                </p>
              )}

              <div className="mt-4 border-t pt-4 text-xs leading-5 text-gray-600">
                <p>Sold by <b>{product.vendor?.storeName || "Zylo-Buylo vendor"}</b></p>
                <p>Payment: Razorpay secure checkout</p>
                <p>Returns: {parsedDescription.details["Return policy"] || "As per product policy"}</p>
              </div>
            </section>
          </aside>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">Product Details</h2>
            {bullets.length > 0 ? (
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-gray-700 sm:grid-cols-2">
                {bullets.map((item) => (
                  <li key={item} className="border-l-2 border-pink-200 pl-3">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-6 text-gray-600">
                Product details will be updated by the vendor soon.
              </p>
            )}
          </div>

          <div className="bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">Seller Information</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-pink-50 text-lg font-black text-pink-700">
                  {product.vendor?.logoUrl ? (
                    <Image
                      src={product.vendor.logoUrl}
                      alt=""
                      fill
                      sizes="56px"
                      className="rounded-full object-cover"
                    />
                  ) : (
                    product.vendor?.storeName?.slice(0, 1) || "Z"
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-950">
                    {product.vendor?.storeName || "Zylo-Buylo vendor"}
                  </p>
                  <p className="mt-1 text-gray-500">
                    {product.vendor?.description ||
                      product.vendor?.businessCategory ||
                      "Verified seller on Zylo-Buylo marketplace."}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="font-bold text-gray-950">4.3</p>
                  <p className="mt-1 text-xs text-gray-500">Rating</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="font-bold text-gray-950">{sellerFollowerCount}</p>
                  <p className="mt-1 text-xs text-gray-500">Followers</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="font-bold text-gray-950">
                    {product.vendor?._count?.products || 1}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Products</p>
                </div>
              </div>
              {product.vendor?.id && (
                <Link
                  href={`/shop/${product.vendor.id}`}
                  className="block rounded-md border border-pink-600 px-4 py-3 text-center text-sm font-bold text-pink-700 transition hover:bg-pink-50"
                >
                  View Shop
                </Link>
              )}
              <div className="rounded-md bg-gray-50 p-3">
                <p className="font-semibold text-gray-950">Category</p>
                <p className="mt-1">{categoryName}</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="font-semibold text-gray-950">Return support</p>
                <p className="mt-1">Request support from your order page after purchase.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {isZoomModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Product image zoom"
        >
          <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-500">Product image</p>
                <p className="line-clamp-1 font-bold text-gray-950">{product.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomModalOpen(false)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <div className="relative min-h-0 flex-1 bg-gray-100 p-3 sm:p-4">
              <Image
                src={images[selectedImage] || fallbackImage}
                alt={product.name}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto border-t bg-white p-3">
                {images.map((image, index) => (
                  <button
                    key={`zoom-${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={`relative h-16 w-16 flex-none overflow-hidden rounded-md border bg-white p-1 ${
                      selectedImage === index
                        ? "border-pink-600 ring-2 ring-pink-100"
                        : "border-gray-200"
                    }`}
                    aria-label={`Open image ${index + 1}`}
                  >
                    <Image
                      src={image || fallbackImage}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isSizeGuideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Size guide"
        >
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-pink-600">
                  Zylo-Buylo Size Guide
                </p>
                <h2 className="text-xl font-bold text-gray-950">
                  {product.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSizeGuideOpen(false)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            <div className="overflow-auto p-4">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    {[
                      "India",
                      "UK",
                      "US",
                      "EU",
                      "Chest",
                      "Waist",
                      "Hip",
                      "Length",
                      "Foot Length",
                    ].map((heading) => (
                      <th key={heading} className="border px-3 py-2">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizeGuideRows.map((row) => (
                    <tr key={row.key}>
                      <td className="border px-3 py-2 font-bold">
                        {row.indiaSize}
                      </td>
                      <td className="border px-3 py-2">{row.ukSize || "-"}</td>
                      <td className="border px-3 py-2">{row.usSize || "-"}</td>
                      <td className="border px-3 py-2">{row.euSize || "-"}</td>
                      <td className="border px-3 py-2">{row.chest || "-"}</td>
                      <td className="border px-3 py-2">{row.waist || "-"}</td>
                      <td className="border px-3 py-2">{row.hip || "-"}</td>
                      <td className="border px-3 py-2">{row.length || "-"}</td>
                      <td className="border px-3 py-2">
                        {row.footLength || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-900">
                Brand sizing can vary. Vendor-provided brand size mapping takes
                priority when available.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
