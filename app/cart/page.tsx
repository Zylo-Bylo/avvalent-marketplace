"use client";

import Link from "next/link";
import { useCartStore } from "@/store/cart-store";

export default function CartPage() {

  const items = useCartStore(
    (state) => state.items
  );

  const total = items.reduce(
    (sum, item) =>
      sum + item.price * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">

      <div className="flex gap-4 mb-6">

        <Link
          href="/"
          className="bg-gray-200 px-4 py-2 rounded-lg"
        >
          Home
        </Link>

        <Link
          href="/products"
          className="bg-blue-500 text-white px-4 py-2 rounded-lg"
        >
          Products
        </Link>

      </div>

      <h1 className="text-3xl font-bold mb-6">
        Cart
      </h1>

      {items.length === 0 ? (
        <p>Cart is empty</p>
      ) : (
        <div className="space-y-4">

          {items.map((item) => (

            <div
              key={item.id}
              className="bg-white p-4 rounded-xl shadow"
            >

              <h2 className="font-bold text-xl">
                {item.name}
              </h2>

              <p>{item.category}</p>

              <p className="text-pink-600 font-bold">
                ₹{item.price}
              </p>

              <p>
                Quantity: {item.quantity}
              </p>

            </div>

          ))}

          <div className="text-2xl font-bold mt-6">
            Total: ₹{total}
          </div>

        </div>
      )}

    </div>
  );
}