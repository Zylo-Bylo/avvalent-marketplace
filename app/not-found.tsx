import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f0e8] px-4 text-stone-950">
      <section className="max-w-xl bg-white p-8 text-center shadow">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#9c7a34]">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold">Page not found</h1>
        <p className="mt-3 text-stone-600">
          This page may have moved, or the product listing is no longer
          available.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="bg-[#6b145d] px-5 py-3 text-sm font-semibold text-white"
          >
            Go Home
          </Link>
          <Link
            href="/products"
            className="border border-stone-300 px-5 py-3 text-sm font-semibold"
          >
            Browse Products
          </Link>
        </div>
      </section>
    </main>
  );
}
