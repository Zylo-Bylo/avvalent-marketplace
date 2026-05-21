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
  image: string;
  category: string;
}

export default function ProductCard({ id, slug, name, price, image, category }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);

  return (
    <Card className="overflow-hidden border border-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/products/${slug}`} className="block relative h-52 w-full overflow-hidden bg-slate-100">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover transition duration-300 hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
      </Link>

      <CardContent className="space-y-3 px-5 py-5">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
          <span>{category}</span>
          <span className="font-semibold text-slate-900">₹{price}</span>
        </div>

        <CardTitle className="text-lg leading-tight text-slate-900">
          <Link href={`/products/${slug}`} className="hover:text-pink-600">
            {name}
          </Link>
        </CardTitle>
      </CardContent>

      <CardFooter className="px-5 pb-5 pt-0">
        <Button
          className="w-full"
          onClick={() => addItem({ id, name, category, price, image })}
        >
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  );
}
