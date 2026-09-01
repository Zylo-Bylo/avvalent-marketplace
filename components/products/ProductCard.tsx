import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardTitle } from '@/components/ui/Card';
import { useCartStore } from '@/store/cart-store';
import { useWishlistStore } from '@/store/wishlist-store';

export interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  shippingCharge?: number | null;
  inventory?: number | null;
  stockStatus?: string | null;
  availableStock?: number | null;
  lowStockThreshold?: number | null;
  criticalStockThreshold?: number | null;
  isPreOrder?: boolean | null;
  allowBackorder?: boolean | null;
  image: string;
  category: string;
}

export default function ProductCard({
  id,
  slug,
  name,
  price,
  mrp,
  discountPercent,
  shippingCharge,
  inventory,
  stockStatus,
  availableStock,
  lowStockThreshold,
  criticalStockThreshold,
  isPreOrder,
  allowBackorder,
  image,
  category,
}: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const addWishlistItem = useWishlistStore((state) => state.addItem);
  const removeWishlistItem = useWishlistStore((state) => state.removeItem);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);
  const hasDeal = Boolean(mrp && mrp > price);
  const wishlistActive = isInWishlist(id);
  const available = Number(availableStock ?? inventory ?? 0);
  const low = Number(lowStockThreshold ?? 10);
  const critical = Number(criticalStockThreshold ?? 3);
  const computedStock =
    isPreOrder
      ? { label: "Pre Order Available", className: "bg-blue-100 text-blue-800", canBuy: true }
      : allowBackorder || stockStatus === "BACKORDER"
        ? { label: "Backorder Available", className: "bg-blue-100 text-blue-800", canBuy: true }
        : available <= 0 || stockStatus === "OUT_OF_STOCK"
          ? { label: "Out of Stock", className: "bg-gray-200 text-gray-800", canBuy: false }
          : available <= critical
            ? { label: `Only ${available} left - Order Soon`, className: "bg-red-100 text-red-800", canBuy: true }
            : available <= low
              ? { label: `Only ${available} left`, className: "bg-orange-100 text-orange-800", canBuy: true }
              : { label: "In Stock", className: "bg-green-100 text-green-800", canBuy: true };

  return (
    <Card className="group overflow-hidden border border-[#eadcc2] bg-[#fffdf8] shadow-[0_5px_18px_rgba(42,35,25,0.055)] transition hover:-translate-y-0.5 hover:border-[#d8bd83] hover:shadow-[0_14px_30px_rgba(42,35,25,0.11)]">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#e8dccb] sm:aspect-[4/5]">
        <Link href={`/products/${slug}`} className="block h-full">
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(min-width: 1440px) 220px, (min-width: 1024px) 23vw, (min-width: 768px) 31vw, 50vw"
          />
        </Link>
        <span className={`absolute left-1.5 top-1.5 max-w-[calc(100%-3.25rem)] truncate rounded-full px-1.5 py-0.5 text-[9px] font-medium sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px] ${computedStock.className}`}>
          {computedStock.label}
        </span>
        <button
          type="button"
          aria-label={wishlistActive ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (wishlistActive) {
              removeWishlistItem(id);
              return;
            }
            addWishlistItem({
              id,
              name,
              category,
              price,
              mrp: mrp || undefined,
              discountPercent: discountPercent || undefined,
              shippingCharge: shippingCharge || undefined,
              image,
            });
          }}
          className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-base font-medium text-[#5f4a28] shadow-sm ring-1 ring-[#eadcc2] transition hover:bg-[#fff7e8] sm:right-2 sm:top-2 sm:h-9 sm:w-9"
        >
          {wishlistActive ? "♥" : "♡"}
        </button>
      </div>

      <CardContent className="space-y-1.5 px-2 py-2 sm:space-y-2 sm:px-3 sm:py-3">
        <div className="hidden items-center justify-between text-[10px] uppercase tracking-[0.1em] text-slate-500 sm:flex sm:text-xs sm:tracking-[0.14em]">
          <span>{category}</span>
          {hasDeal && (
            <span className="font-semibold text-green-700">
              {discountPercent || 0}% off
            </span>
          )}
        </div>

        <CardTitle className="line-clamp-2 min-h-8 text-[11px] font-normal leading-4 text-[#241f18] sm:min-h-9 sm:text-[13px] sm:leading-[1.35]">
          <Link href={`/products/${slug}`} className="hover:text-[#8a6a30]">
            {name}
          </Link>
        </CardTitle>

        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-sm font-medium text-[#241f18] sm:text-base">Rs. {price}</span>
          {hasDeal && (
            <span className="text-[10px] text-slate-500 line-through sm:text-sm">
              Rs. {mrp}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="px-2 pb-2 pt-0 sm:px-3 sm:pb-3">
        <Button
          className="w-auto rounded-full px-3 py-1.5 text-[10px] uppercase"
          disabled={!computedStock.canBuy}
          onClick={() =>
            addItem({
              id,
              name,
              category,
              price,
              mrp: mrp || undefined,
              discountPercent: discountPercent || undefined,
              shippingCharge: shippingCharge || undefined,
              image,
            })
          }
        >
          {computedStock.canBuy ? "Add to Cart" : "Out of Stock"}
        </Button>
      </CardFooter>
    </Card>
  );
}
