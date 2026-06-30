import Link from 'next/link';
import Navbar from '@/components/navbar/Navbar';

const sections = [
  {
    title: 'Information we collect',
    points: [
      'Customer account details such as name, email address, mobile number, delivery address and order history.',
      'Vendor registration details such as mobile number, email, business name, business address, PAN, GST details where applicable, bank or UPI details and uploaded KYC documents.',
      'Product, catalog, stock, pricing, dispatch proof, shipping label proof, delivery OTP, open-box confirmation and return evidence data.',
      'Technical information such as device/browser details, IP address, session details, security logs and platform activity needed for account safety.',
    ],
  },
  {
    title: 'How we use information',
    points: [
      'To create accounts, verify vendors, process orders, collect payments, manage COD, arrange dispatch and provide order updates.',
      'To manage vendor payouts, refund adjustments, return requests, fraud checks, customer protection and vendor protection records.',
      'To improve product search, catalog quality, stock accuracy, customer support, dispute handling and platform security.',
      'To comply with legal, tax, payment, ecommerce, fraud prevention and business record requirements.',
    ],
  },
  {
    title: 'Sharing and service providers',
    points: [
      'Order and delivery details may be shared with vendors, courier partners, payment gateways and support providers as needed to complete an order.',
      'Payment processing may be handled by third-party payment providers such as Razorpay or other enabled payment gateways.',
      'Zylo-Buylo does not sell customer personal information as a separate product.',
      'Information may be shared when required by law, dispute process, fraud investigation, payment chargeback, tax review or regulatory request.',
    ],
  },
  {
    title: 'Documents and evidence',
    points: [
      'Vendor KYC, bank proof, GST/PAN details and business documents are used for vendor verification, payout and compliance checks.',
      'Dispatch images, packed product images, shipping label images, delivery OTP records, open-box proof and return evidence may be kept for order security and dispute resolution.',
      'Return evidence such as photos or short videos should only show the product issue and should avoid unnecessary personal or sensitive information.',
    ],
  },
  {
    title: 'Security and retention',
    points: [
      'We use access controls and platform security practices to reduce unauthorized access to account, order, payment and vendor data.',
      'Records may be retained as long as needed for orders, returns, payouts, tax/accounting, fraud prevention, legal claims and platform security.',
      'When information is no longer needed, Zylo-Buylo may delete, anonymize or archive records according to business and legal requirements.',
    ],
  },
  {
    title: 'Your choices',
    points: [
      'Customers can review orders, profile information and delivery information from their account where available.',
      'Vendors can update business profile, bank details and KYC information through the vendor flow where available.',
      'For correction, account, privacy or data-related requests, contact Zylo-Buylo support using the public support details shown on the platform.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-600">
            Data and Privacy
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            Last updated: 29 June 2026
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            This Privacy Policy explains how Zylo-Buylo may collect, use and protect
            information for customer orders, vendor onboarding, payments, COD,
            delivery verification, returns, refunds and marketplace safety. This
            page should be reviewed by a legal/privacy professional before full
            public launch.
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
            <Link href="/terms" className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white">
              Terms and Conditions
            </Link>
            <Link href="/return-policy" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">
              Return Policy
            </Link>
            <Link href="/cod-policy" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">
              COD Policy
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
