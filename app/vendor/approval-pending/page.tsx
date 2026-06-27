"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/navbar/Navbar";

function ApprovalPendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="mx-auto flex min-h-[calc(100vh-88px)] max-w-3xl items-center px-4 py-10">
        <section className="w-full rounded-2xl bg-white p-8 shadow">
          <div className="mb-5 inline-flex rounded-full bg-yellow-100 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-yellow-800">
            Pending Approval
          </div>

          <h1 className="text-3xl font-bold text-gray-950">
            Your vendor account is waiting for admin approval.
          </h1>

          <p className="mt-4 text-gray-600">
            We saved your vendor registration. Product upload, product
            management, and full vendor dashboard access will unlock after the
            admin approves your account.
          </p>

          {email && (
            <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
              Registered email: <span className="font-semibold">{email}</span>
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl border px-5 py-3 text-sm font-semibold"
            >
              Go Home
            </Link>
            <Link
              href="/login?role=vendor&next=/vendor/dashboard"
              className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white"
            >
              Vendor Login
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function VendorApprovalPendingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-100">
          <p className="text-gray-600">Loading approval status...</p>
        </main>
      }
    >
      <ApprovalPendingContent />
    </Suspense>
  );
}
