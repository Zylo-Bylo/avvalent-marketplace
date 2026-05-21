"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/navbar/Navbar";
import { useCartStore } from "@/store/cart-store";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  images: string[];
  category?: {
    name: string;
  } | null;
  vendor?: {
    storeName: string;
  } | null;
};

const fallbackImage = "https://placehold.co/600x800/png?text=No+Image";

function getNumericId(productId: string) {
  return productId.split("").reduce((total, character) => {
    return total + character.charCodeAt(0);
  }, 0);
}

export default function ProductDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const { addItem } = useCartStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadProduct() {
      if (!id) {
        return;
      }

      const response = await fetch(`/api/products/${id}`, { cache: "no-store" });

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

  if (loading || !product) {
    return (
      <main className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="p-10 text-center text-gray-600">
          {loading ? "Loading..." : "Product not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <Navbar />

      <div className="mx-auto grid max-w-6xl gap-10 p-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="relative h-[500px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.images?.[0] || fallbackImage}
              alt={product.name}
              className="h-full w-full rounded-xl object-cover"
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow">
          <p className="text-sm font-semibold text-pink-600">
            {product.vendor?.storeName || product.category?.name || "Product"}
          </p>

          <h1 className="mt-2 text-4xl font-bold">{product.name}</h1>

          <p className="mt-4 text-gray-500">{product.description}</p>

          <p className="mt-6 text-4xl font-bold text-pink-600">
            Rs. {product.price}
          </p>

          <button
            onClick={() =>
              addItem({
                id: getNumericId(product.id),
                name: product.name,
                category: product.category?.name || "Product",
                price: Number(product.price),
                image: product.images?.[0] || fallbackImage,
              })
            }
            className="mt-8 rounded-xl bg-pink-500 px-8 py-4 text-lg font-bold text-white hover:bg-pink-600"
          >
            Add To Cart
          </button>
        </div>
      </div>
    </main>
  );
}
