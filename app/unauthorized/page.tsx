import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-[#f8f5ef] px-6 py-16 text-[#111827]">
      <section className="mx-auto max-w-2xl border border-[#e1d4bd] bg-white p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#9a6a16]">
          Access denied
        </p>
        <h1 className="mt-3 text-3xl font-black">Admin access required</h1>
        <p className="mt-3 text-sm text-[#5f5a52]">
          This area is restricted to verified Zylo-Buylo administrators.
        </p>
        <Link
          href="/login?admin=1"
          className="mt-6 inline-flex border border-[#111827] bg-[#111827] px-4 py-2 text-sm font-black text-white"
        >
          Go to admin login
        </Link>
      </section>
    </main>
  );
}
