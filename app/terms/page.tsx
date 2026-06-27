import Link from 'next/link';
import Navbar from '@/components/navbar/Navbar';

const sections = [
  {
    title: 'Customer ordering terms',
    points: [
      'Customer must provide correct name, mobile number, address and delivery PIN code.',
      'Order OTP must be shared only after payment and product/package verification.',
      'For open-box eligible orders, customer should check product name, color, size, quantity and brand before OTP confirmation.',
      'After OTP confirmation, the order may be treated as delivered and accepted subject to genuine defect or warranty claims.',
    ],
  },
  {
    title: 'Cash on Delivery terms',
    points: [
      'COD availability may depend on order value, location, customer history, product category and admin risk checks.',
      'Customer must keep exact cash ready and pay before delivery OTP completion.',
      'Repeated COD refusal, fake order attempts or unreachable delivery behavior may restrict COD access.',
      'COD refunds are processed through approved bank, UPI or wallet mode. Cash refund at doorstep is not supported.',
    ],
  },
  {
    title: 'Return and trust rule',
    points: [
      'Only genuine issues are eligible for return.',
      'Allowed reasons include damaged product, manufacturing defect, not working, missing parts, wrong product, fake product suspected, warranty issue and hidden transit damage.',
      'Preference based reasons such as did not like, changed mind, no longer needed or found cheaper elsewhere are not valid after verified delivery.',
      'Customer may be required to upload product photos, defect photos and short video evidence.',
    ],
  },
  {
    title: 'Vendor and marketplace terms',
    points: [
      'Vendors must list correct product, pricing, stock, GST, HSN, brand, images and return policy details.',
      'Vendor payout is subject to order delivery, COD or online payment reconciliation, platform fee, return window and dispute checks.',
      'Wrong dispatch, fake brand claim, duplicate SKU misuse or poor quality proof may lead to product removal or vendor deactivation.',
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-600">
            Zylo-Buylo Legal
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Terms and Conditions
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            These terms define how Zylo-Buylo handles customer orders, COD, delivery OTP,
            open-box verification, returns, vendor duties and marketplace protection.
          </p>

          <div className="mt-8 grid gap-5">
            {sections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-slate-200 p-5">
                <h2 className="text-xl font-bold">{section.title}</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/cod-policy" className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white">
              COD Policy
            </Link>
            <Link href="/vendor-agreement" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">
              Vendor Agreement
            </Link>
            <Link href="/return-policy" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">
              Return Policy
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
