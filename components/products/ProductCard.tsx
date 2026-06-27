import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardTitle } from '@/components/ui/Card';
import { useCartStore } from '@/store/cart-store';

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
  const hasDeal = Boolean(mrp && mrp > price);
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
    <Card className="overflow-hidden border border-[#f0d8e8] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#9f2089] hover:shadow-xl">
      <Link href={`/products/${slug}`} className="relative block aspect-[2/3] w-full overflow-hidden bg-gradient-to-br from-[#fff8fc] to-slate-100 sm:h-52 sm:aspect-auto">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover transition duration-300 hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <span className={`absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs ${computedStock.className}`}>
          {computedStock.label}
        </span>
      </Link>

      <CardContent className="space-y-1.5 px-2 py-2 sm:space-y-3 sm:px-5 sm:py-5">
        <div className="hidden items-center justify-between text-[10px] uppercase tracking-[0.1em] text-slate-500 sm:flex sm:text-xs sm:tracking-[0.14em]">
          <span>{category}</span>
          {hasDeal && (
            <span className="font-semibold text-green-700">
              {discountPercent || 0}% off
            </span>
          )}
        </div>

        <CardTitle className="line-clamp-2 text-[11px] font-black leading-4 text-slate-900 sm:text-lg sm:leading-tight">
          <Link href={`/products/${slug}`} className="hover:text-pink-600">
            {name}
          </Link>
        </CardTitle>

        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-black text-[#c2410c] sm:text-xl">Rs. {price}</span>
          {hasDeal && (
            <span className="text-[10px] text-slate-500 line-through sm:text-sm">
              Rs. {mrp}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="px-2 pb-2 pt-0 sm:px-5 sm:pb-5">
        <Button
          className="w-full"
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
