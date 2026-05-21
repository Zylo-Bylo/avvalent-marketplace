"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f0e8] px-4 text-stone-950">
      <section className="max-w-xl bg-white p-8 text-center shadow">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
          Error
        </p>
        <h1 className="mt-3 text-3xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-stone-600">
          The page could not load correctly. Try again or return to the
          marketplace.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-[#6b145d] px-5 py-3 text-sm font-semibold text-white"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="border border-stone-300 px-5 py-3 text-sm font-semibold"
          >
            Go Home
          </Link>
        </div>
      </section>
    </main>
  );
}
