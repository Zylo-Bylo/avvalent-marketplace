import Link from 'next/link';
import Navbar from '@/components/navbar/Navbar';
import {
  CUSTOMER_TERMS_VERSION,
  VENDOR_AGREEMENT_VERSION,
} from '@/lib/legal-policy';

const policies = [
  {
    title: 'Terms and Conditions',
    route: '/terms',
    version: CUSTOMER_TERMS_VERSION,
    notes: 'Customer ordering, delivery OTP, returns and marketplace rules.',
  },
  {
    title: 'COD Policy',
    route: '/cod-policy',
    version: CUSTOMER_TERMS_VERSION,
    notes: 'Cash collection, COD refusal, OTP, open-box and refund rules.',
  },
  {
    title: 'Return Policy',
    route: '/return-policy',
    version: CUSTOMER_TERMS_VERSION,
    notes: 'Allowed return reasons, blocked preference reasons and evidence requirements.',
  },
  {
    title: 'Vendor Agreement',
    route: '/vendor-agreement',
    version: VENDOR_AGREEMENT_VERSION,
    notes: 'Vendor KYC, compliance, product quality, dispatch proof, payout and indemnity rules.',
  },
];

export default function AdminPoliciesPage() {
  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <Navbar />
      <section className="border-b border-stone-200 bg-[#17130f] text-[#f8efe2]">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Link href="/admin/dashboard" className="text-sm text-[#d6b36a]">
            Back to Admin Dashboard
          </Link>
          <h1 className="mt-3 text-4xl font-bold">Policy Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
            One place to verify live customer and vendor policy versions.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-5 md:grid-cols-2">
          {policies.map((policy) => (
            <article key={policy.route} className="bg-white p-6 shadow">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6b145d]">
                Version {policy.version}
              </p>
              <h2 className="mt-3 text-2xl font-bold">{policy.title}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{policy.notes}</p>
              <Link
                href={policy.route}
                target="_blank"
                className="mt-5 inline-block bg-[#6b145d] px-5 py-3 text-sm font-semibold text-white"
              >
                Open policy
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-yellow-200 bg-yellow-50 p-5 text-sm leading-6 text-yellow-900">
          <p className="font-bold">Admin reminder</p>
          <p className="mt-1">
            When a policy version changes, vendors should accept the latest vendor agreement
            before continuing dashboard work. Customer checkout already requires terms acceptance
            before order creation.
          </p>
        </div>
      </section>
    </main>
  );
}
