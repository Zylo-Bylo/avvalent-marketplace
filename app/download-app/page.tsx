import Link from "next/link";

export default function DownloadAppPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f9] px-4 py-10 text-[#111827]">
      <section className="mx-auto max-w-3xl rounded-md bg-white p-6 text-center shadow-sm sm:p-10">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#6b145d]">
          Zylo-Buylo App
        </p>
        <h1 className="mt-3 text-4xl font-black">Download links coming soon</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#565959]">
          We are preparing Google Play and App Store links. For now, you can use
          Zylo-Buylo.com on mobile for shopping, cart, checkout, orders and
          vendor access.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/products"
            className="rounded-sm bg-[#6b145d] px-6 py-3 text-sm font-black uppercase text-white"
          >
            Shop Products
          </Link>
          <Link
            href="/"
            className="rounded-sm border border-[#6b145d] px-6 py-3 text-sm font-black uppercase text-[#6b145d]"
          >
            Back Home
          </Link>
        </div>
      </section>
    </main>
  );
}
