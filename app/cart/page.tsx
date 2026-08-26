"use client";

import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/store/cart-store";

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const deliveryIncluded = items.reduce(
    (sum, item) => sum + (item.shippingCharge || 0) * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-6 flex gap-4">
        <Link href="/" className="rounded-lg bg-gray-200 px-4 py-2">
          Home
        </Link>

        <Link
          href="/products"
          className="rounded-lg bg-blue-500 px-4 py-2 text-white"
        >
          Products
        </Link>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-bold">Cart</h1>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            Clear Cart
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow">
          <p className="text-gray-600">Cart is empty</p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-lg bg-pink-600 px-5 py-3 font-semibold text-white"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow md:flex-row md:items-center md:justify-between"
            >
              <div className="flex gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                <Image
                  src={
                    item.image || "/product-placeholder.svg"
                  }
                  alt={item.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
                </div>

                <div>
                  <h2 className="text-xl font-bold">{item.name}</h2>
                  <p className="text-sm text-gray-500">{item.category}</p>
                  {(item.sizeLabel || item.numericSize || item.color || item.sku) && (
                    <p className="mt-1 text-xs font-semibold text-gray-600">
                      {[item.sizeLabel, item.numericSize && `Size ${item.numericSize}`, item.color, item.sku && `SKU ${item.sku}`]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                  )}
                  <p className="mt-2 font-bold text-pink-600">
                    Rs. {item.price}
                  </p>
                  {item.mrp && item.mrp > item.price && (
                    <p className="text-sm text-gray-500">
                      <span className="line-through">Rs. {item.mrp}</span>{" "}
                      <span className="font-semibold text-green-700">
                        {item.discountPercent || 0}% off
                      </span>
                    </p>
                  )}
                  <p className="text-xs text-green-700">
                    Delivery {item.shippingCharge ? `Rs. ${item.shippingCharge} included` : "included"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="px-3 py-2 text-lg font-bold hover:bg-gray-100"
                    aria-label={`Decrease quantity for ${item.name}`}
                  >
                    -
                  </button>
                  <span className="min-w-12 px-3 py-2 text-center font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="px-3 py-2 text-lg font-bold hover:bg-gray-100"
                    aria-label={`Increase quantity for ${item.name}`}
                  >
                    +
                  </button>
                </div>

                <p className="min-w-24 font-bold">
                  Rs. {item.price * item.quantity}
                </p>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="rounded-xl bg-white p-5 shadow">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">
                  Cart Total
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-950">
                  Rs. {total}
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Delivery included: Rs. {deliveryIncluded}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/products"
                  className="rounded-lg border border-gray-300 px-5 py-3 text-center text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                >
                  Continue Shopping
                </Link>
                <Link
                  href="/checkout"
                  className="rounded-lg bg-pink-600 px-6 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-pink-700"
                >
                  Buy Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
