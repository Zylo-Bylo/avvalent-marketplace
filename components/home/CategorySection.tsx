import Link from 'next/link';

const categories = [
  {
    name: 'Fashion',
    description: 'Apparel, accessories, and trending styles from verified sellers.',
    href: '/products?category=Fashion',
    badge: 'New',
    color: 'bg-pink-50 text-pink-600',
  },
  {
    name: 'Electronics',
    description: 'Smart devices, home tech, and everyday electronics.',
    href: '/products?category=Electronics',
    badge: 'Top',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    name: 'Home',
    description: 'Decor, kitchen goods, and furniture for modern homes.',
    href: '/products?category=Home',
    badge: 'Popular',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    name: 'Beauty',
    description: 'Skincare, wellness, and beauty essentials from trusted vendors.',
    href: '/products?category=Beauty',
    badge: 'Trending',
    color: 'bg-purple-50 text-purple-700',
  },
];

export default function CategorySection() {
  return (
    <section className="py-16">
      <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-pink-600">Categories</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Discover categories curated for every shopper.
          </h2>
        </div>
        <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
          Explore trusted vendors across fashion, electronics, home, and beauty with a single tap.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.name}
            href={category.href}
            className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${category.color}`}>
                {category.badge}
              </span>
              <span className="text-sm font-medium text-slate-400 transition group-hover:text-slate-600">
                Explore
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <h3 className="text-xl font-semibold text-slate-900">{category.name}</h3>
              <p className="text-sm leading-6 text-slate-600">{category.description}</p>
            </div>

            <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-pink-700">
              <span>Browse products</span>
              <span aria-hidden="true">→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
