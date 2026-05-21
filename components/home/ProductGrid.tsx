'use client';

import Link from 'next/link';

const products = [
  {
    id: "1",
    name: "Women Kurti",
    price: 499,
    image: "/products/kurti.jpg",
  },

  {
    id: "2",
    name: "Mens Shoes",
    price: 999,
    image: "/products/shoes.jpg",
  },

  {
    id: "3",
    name: "Smart Watch",
    price: 1499,
    image: "/products/watch.jpg",
  },

  {
    id: "4",
    name: "Beauty Cream",
    price: 299,
    image: "/products/cream.jpg",
  },
];

export default function ProductGrid() {
  return (
    <div className="p-6">

      <h2 className="text-3xl font-bold mb-6">
        Trending Products
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

        {products.map((product) => (

          <Link
            key={product.id}
            href={`/products/${product.id}`}
          >

            <div className="bg-white rounded-2xl shadow hover:shadow-xl overflow-hidden cursor-pointer">

              <img
                src={product.image}
                alt={product.name}
                className="w-full h-64 object-cover"
              />

              <div className="p-4">

                <h3 className="font-semibold text-lg">
                  {product.name}
                </h3>

                <p className="text-pink-600 font-bold text-xl mt-2">
                  ₹{product.price}
                </p>

              </div>

            </div>

          </Link>

        ))}

      </div>

    </div>
  );
}