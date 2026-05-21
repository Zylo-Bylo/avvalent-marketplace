'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useCartStore } from '@/store/cart-store';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  images: string[];
  inventory: number;
  vendor: {
    storeName: string;
    description: string;
  };
  category?: {
    name: string;
  };
  reviews: Array<{
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
    user: {
      name: string;
    };
  }>;
}

interface ProductDetailProps {
  product: Product;
}

export default function ProductDetail({ product }: ProductDetailProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCartStore();

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      category: product.category?.name || 'Product',
      price: product.price,
      image: product.images[0] || '/placeholder.jpg',
    });
  };

  const averageRating = product.reviews.length > 0
    ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length
    : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Product Images */}
      <div className="space-y-4">
        <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
          {product.images[selectedImage] ? (
            <Image
              src={product.images[selectedImage]}
              alt={product.name}
              width={600}
              height={600}
              className="h-full w-full object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              No image available
            </div>
          )}
        </div>
        {product.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {product.images.map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                  selectedImage === index ? 'border-pink-500' : 'border-slate-200'
                }`}
              >
                <Image
                  src={image}
                  alt={`${product.name} ${index + 1}`}
                  width={80}
                  height={80}
                  className="h-20 w-20 object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
          <div className="mt-2 flex items-center gap-4">
            <span className="text-2xl font-bold text-pink-600">₹{product.price.toFixed(2)}</span>
            {product.category && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                {product.category.name}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-lg ${i < Math.floor(averageRating) ? 'text-yellow-400' : 'text-slate-300'}`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="text-sm text-slate-600">
              {averageRating.toFixed(1)} ({product.reviews.length} reviews)
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-slate-700">{product.description}</p>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600">Sold by:</span>
            <span className="text-sm text-slate-900">{product.vendor.storeName}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600">Availability:</span>
            <span className={`text-sm font-medium ${product.inventory > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {product.inventory > 0 ? `${product.inventory} in stock` : 'Out of stock'}
            </span>
          </div>
        </div>

        {/* Add to Cart */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Quantity:</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                -
              </button>
              <span className="w-12 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(product.inventory, quantity + 1))}
                className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                +
              </button>
            </div>
          </div>

          <Button
            onClick={handleAddToCart}
            className="w-full"
            disabled={product.inventory === 0}
          >
            {product.inventory > 0 ? 'Add to Cart' : 'Out of Stock'}
          </Button>
        </div>

        {/* Reviews */}
        {product.reviews.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Customer Reviews</h2>
            <div className="space-y-4">
              {product.reviews.slice(0, 3).map((review) => (
                <Card key={review.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{review.user.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className={`text-sm ${i < review.rating ? 'text-yellow-400' : 'text-slate-300'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {review.comment && <p className="text-sm text-slate-700">{review.comment}</p>}
                    <p className="mt-2 text-xs text-slate-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {product.reviews.length > 3 && (
              <p className="text-sm text-slate-600">
                And {product.reviews.length - 3} more reviews...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
