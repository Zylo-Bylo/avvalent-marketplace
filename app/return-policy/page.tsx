import Navbar from '@/components/navbar/Navbar';

const allowedReasons = [
  'Manufacturing defect',
  'Product damaged after opening',
  'Product not working',
  'Missing parts',
  'Wrong product received when delivery verification is not complete',
  'Fake product suspected',
  'Warranty issue',
  'Transit damage hidden inside package',
  'Quality not matching vendor description',
];

const blockedReasons = [
  'Did not like product',
  'Changed my mind',
  'No longer needed',
  'Found cheaper elsewhere',
  'Preference based size, color or brand issue after verified open-box delivery',
];

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-600">
            Zylo-Buylo Trust Rule
          </p>
          <h1 className="mt-3 text-3xl font-black">Return Policy</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Only genuine issues are eligible for return. Customer evidence,
            dispatch proof, OTP proof and open-box verification can be reviewed before approval.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <section className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <h2 className="text-lg font-bold text-green-950">Allowed return reasons</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-green-900">
                {allowedReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <h2 className="text-lg font-bold text-red-950">Not allowed after verified delivery</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-red-900">
                {blockedReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
