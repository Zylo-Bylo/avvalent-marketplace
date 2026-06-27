import Image from "next/image";
import Link from "next/link";

const benefits = [
  {
    title: "No monthly listing fee",
    text: "Start your online shop without paying a monthly platform fee.",
  },
  {
    title: "Sell across categories",
    text: "Fashion, electronics, beauty, home, appliance parts and accessories.",
  },
  {
    title: "Stock and order tools",
    text: "Update inventory, manage orders and track delivery status from the vendor dashboard.",
  },
  {
    title: "Payout reports",
    text: "View sales, pending payments and payout history in one place.",
  },
];

const steps = [
  "Create vendor account",
  "Submit business and bank details",
  "Upload products and stock",
  "Admin verifies your store",
  "Start receiving orders",
];

const documents = [
  "Mobile number and email",
  "PAN / Aadhaar details",
  "GST details if applicable",
  "Bank account and UPI ID",
  "Business address",
];

const categories = [
  "Fashion",
  "Electronics",
  "Beauty",
  "Home & Kitchen",
  "AC Parts",
  "TV Parts",
  "Washing Machine Parts",
  "Mobile Accessories",
];

const faqs = [
  {
    question: "How do I start selling on Zylo-Buylo?",
    answer: "Click Start Selling, complete the vendor registration form, submit documents and wait for admin approval.",
  },
  {
    question: "Can I add products before approval?",
    answer: "Your account can be created first, but product selling depends on store approval and completed profile details.",
  },
  {
    question: "Where will I manage orders?",
    answer: "After approval, open the vendor dashboard to manage products, stock, orders, returns and payouts.",
  },
  {
    question: "How are payouts tracked?",
    answer: "Vendor payout reports show order amounts, commission, deductions, pending payout and paid payout status.",
  },
];

export default function SupplierPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f9] text-[#111827]">
      <header className="sticky top-0 z-50 border-b border-[#ead8e7] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="text-2xl font-black text-[#6b145d]">
            Zylo-Buylo
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-bold text-[#374151] md:flex">
            <a href="#benefits" className="hover:text-[#6b145d]">Benefits</a>
            <a href="#steps" className="hover:text-[#6b145d]">How it works</a>
            <a href="#faq" className="hover:text-[#6b145d]">FAQ</a>
          </nav>
          <Link
            href="/vendor/register"
            className="rounded-sm bg-[#6b145d] px-4 py-2 text-sm font-black text-white hover:bg-[#8b2c72]"
          >
            Start Selling
          </Link>
        </div>
      </header>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <p className="w-fit rounded-full bg-[#fff0f6] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#6b145d]">
              Zylo-Buylo Supplier
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-[#111827] md:text-6xl">
              Sell online with
              <span className="block text-[#e71876]">Zylo-Buylo</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#565959]">
              Open your vendor store, list products, manage stock, receive
              orders and grow your business through Zylo-Buylo marketplace.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/vendor/register"
                className="rounded-sm bg-[#6b145d] px-7 py-3 text-sm font-black uppercase text-white shadow hover:bg-[#8b2c72]"
              >
                Start Selling
              </Link>
              <Link
                href="/login?next=/vendor/dashboard"
                className="rounded-sm border border-[#6b145d] bg-white px-7 py-3 text-sm font-black uppercase text-[#6b145d] hover:bg-[#fff4fb]"
              >
                Vendor Login
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["0 setup fee", "Fast approval", "Dashboard tools"].map((item) => (
                <div key={item} className="rounded-md border border-[#ead8e7] bg-[#fff8fc] px-4 py-3 text-sm font-black text-[#6b145d]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[300px] overflow-hidden rounded-md bg-[#fff0f6] shadow-sm md:min-h-[420px]">
            <Image
              src="/hero-marketplace-visual.png"
              alt="Zylo-Buylo supplier marketplace"
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-contain p-6"
            />
          </div>
        </div>
      </section>

      <section id="benefits" className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="rounded-md bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-[#111827]">{benefit.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#565959]">{benefit.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="steps" className="mx-auto grid max-w-7xl gap-5 px-4 py-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md bg-[#111827] p-6 text-white shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ffd166]">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-black">Start in 5 steps</h2>
          <div className="mt-6 grid gap-3">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-md bg-white/10 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-[#111827]">
                  {index + 1}
                </span>
                <span className="text-sm font-bold">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md bg-white p-6 shadow-sm">
          <h2 className="text-3xl font-black">Documents and details needed</h2>
          <p className="mt-3 text-sm leading-6 text-[#565959]">
            Keep these details ready before starting the vendor form.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {documents.map((item) => (
              <div key={item} className="rounded-md border border-[#e5e7eb] px-4 py-3 text-sm font-bold">
                {item}
              </div>
            ))}
          </div>
          <Link
            href="/vendor/register"
            className="mt-6 inline-flex rounded-sm bg-[#6b145d] px-6 py-3 text-sm font-black uppercase text-white hover:bg-[#8b2c72]"
          >
            Open Registration Form
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-md bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#6b145d]">
                Sell categories
              </p>
              <h2 className="mt-2 text-3xl font-black">What can you sell?</h2>
            </div>
            <Link href="/products" className="text-sm font-bold text-[#007185]">
              View marketplace
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((category) => (
              <div key={category} className="rounded-md border border-[#ead8e7] bg-[#fff8fc] px-4 py-4 text-center text-sm font-black text-[#242334]">
                {category}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-md bg-[#6b145d] p-6 text-white shadow-sm">
            <h2 className="text-3xl font-black">Supplier FAQ</h2>
            <p className="mt-3 text-sm leading-6 text-white/80">
              Common questions before joining Zylo-Buylo marketplace.
            </p>
          </div>
          <div className="grid gap-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="rounded-md bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-base font-black">
                  {faq.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-[#565959]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 pt-6">
        <div className="rounded-md bg-[#fff0f6] p-6 text-center shadow-sm sm:p-8">
          <h2 className="text-3xl font-black text-[#111827]">
            Ready to sell on Zylo-Buylo?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#565959]">
            Create your account, complete KYC and submit your store for approval.
          </p>
          <Link
            href="/vendor/register"
            className="mt-6 inline-flex rounded-sm bg-[#6b145d] px-7 py-3 text-sm font-black uppercase text-white hover:bg-[#8b2c72]"
          >
            Start Selling Now
          </Link>
        </div>
      </section>
    </main>
  );
}
