import Link from 'next/link';
import Navbar from '@/components/navbar/Navbar';

export default function CodPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-600">
            Payment Safety
          </p>
          <h1 className="mt-3 text-3xl font-black">Cash on Delivery Policy</h1>
          <div className="mt-6 space-y-5 text-sm leading-6 text-slate-700">
            <section>
              <h2 className="text-lg font-bold text-slate-950">COD order rule</h2>
              <p className="mt-2">
                COD orders are accepted only when the customer agrees to payment,
                delivery OTP, open-box verification, refund and return rules during checkout.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-bold text-slate-950">Delivery process</h2>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Customer pays cash to the delivery partner before OTP completion.</li>
                <li>Customer checks package or open-box product where applicable.</li>
                <li>OTP confirmation completes delivery verification.</li>
                <li>COD collected status is used for vendor payout reconciliation.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-bold text-slate-950">Fraud protection</h2>
              <p className="mt-2">
                Zylo-Buylo may restrict COD for high value orders, repeated refusals,
                unreachable customers, fake order patterns or suspicious activity.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-bold text-slate-950">Refunds</h2>
              <p className="mt-2">
                COD refunds are processed by bank transfer, UPI or wallet after return approval.
                Doorstep cash refund is not supported.
              </p>
            </section>
          </div>
          <Link href="/checkout" className="mt-8 inline-block rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white">
            Back to checkout
          </Link>
        </div>
      </main>
    </div>
  );
}
