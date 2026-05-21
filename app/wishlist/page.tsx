"use client";

import Link from "next/link";
import { useWishlistStore } from "@/store/wishlist-store";

export default function WishlistPage() {

  const items = useWishlistStore(
    (state) => state.items
  );

  const removeItem = useWishlistStore(
    (state) => state.removeItem
  );

  return (
    <main className="min-h-screen bg-gray-100 p-6">

      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6">

          <h1 className="text-3xl font-bold">
            My Wishlist ❤️
          </h1>

          <Link
            href="/"
            className="bg-pink-500 text-white px-4 py-2 rounded-lg"
          >
            Home
          </Link>

        </div>

        {items.length === 0 ? (

          <div className="bg-white rounded-xl p-10 text-center shadow">

            <h2 className="text-2xl font-bold mb-3">
              Wishlist is Empty
            </h2>

            <p className="text-gray-500">
              Save products to wishlist ❤️
            </p>

          </div>

        ) : (

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">

            {items.map((product) => (

              <div
                key={product.id}
                className="bg-white rounded-xl shadow p-4"
              >

                <div className="h-40 overflow-hidden rounded mb-3">

                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />

                </div>

                <h3 className="font-bold text-lg">
                  {product.name}
                </h3>

                <p className="text-gray-500 text-sm">
                  {product.category}
                </p>

                <div className="flex items-center justify-between mt-4">

                  <p className="text-pink-600 font-bold">
                    ₹{product.price}
                  </p>

                  <button
                    onClick={() =>
                      removeItem(product.id)
                    }
                    className="bg-red-500 text-white px-3 py-1 rounded-lg"
                  >
                    Remove
                  </button>

                </div>

              </div>

            ))}

          </div>

        )}

      </div>

    </main>
  );
}