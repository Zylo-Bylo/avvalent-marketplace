import Link from 'next/link';
import Navbar from '@/components/navbar/Navbar';
import { VENDOR_AGREEMENT_VERSION } from '@/lib/legal-policy';

const agreementSections = [
  {
    title: '1. Electronic Acceptance',
    points: [
      'This Vendor Agreement is an electronic agreement between Zylo-Buylo and the registered vendor.',
      'By clicking "I accept" during vendor registration, the vendor confirms that the agreement has been read, understood and accepted.',
      'No physical signature is required for acceptance of this agreement on the Zylo-Buylo platform.',
    ],
  },
  {
    title: '2. Marketplace Role',
    points: [
      'Zylo-Buylo operates as an online marketplace that enables vendors to list, sell and manage products through the platform.',
      'The vendor remains responsible for product ownership, product quality, legal compliance, invoice information, packaging and dispatch accuracy.',
      'Zylo-Buylo may provide order management, payment collection, customer communication, delivery tracking, return review and vendor payout support.',
    ],
  },
  {
    title: '3. Vendor Registration, KYC and Bank Details',
    points: [
      'The vendor must provide true business name, mobile number, email, GST/PAN/Aadhaar details where applicable, business address and bank or UPI details.',
      'KYC documents, GST certificate, PAN, Aadhaar and bank proof must belong to the vendor or authorized business entity.',
      'Zylo-Buylo may keep the vendor account in pending, inactive or rejected status if information is incomplete, false or unverifiable.',
    ],
  },
  {
    title: '4. Product Listing and Catalog Quality',
    points: [
      'Product title, brand, category, subcategory, SKU, HSN, GST, price, MRP, stock, size, color, warranty and return policy must be accurate.',
      'Product images must be clear, genuine, non-misleading and should not include fake branding, watermark, unrelated objects or wrong product photos.',
      'The vendor must not list counterfeit, restricted, unsafe, illegal, copied, duplicate or misleading products.',
      'Each product variant must use correct size, color, stock and SKU information so customers receive exactly what was ordered.',
    ],
  },
  {
    title: '5. Price, Fees, Taxes and Payout',
    points: [
      'The vendor must enter correct vendor price, customer price, MRP, discount, GST, HSN code, packaging charge and delivery-related details.',
      'Vendor payout may be calculated after platform fee, packaging, delivery, COD collection, refund, return or adjustment rules where applicable.',
      'COD payout is released only after successful delivery, cash collection and reconciliation.',
      'Zylo-Buylo may hold or adjust payout for cancelled orders, return claims, fraud review, wrong dispatch, fake listing or customer protection cases.',
    ],
  },
  {
    title: '6. Order Processing and Dispatch Proof',
    points: [
      'The vendor must process orders within the required time and update courier name, tracking number and dispatch status correctly.',
      'Where required, the vendor must upload product images, packed product images and shipping label proof before dispatch completion.',
      'Wrong item dispatch, missing item dispatch, fake tracking, delayed dispatch or repeated cancellation may lead to product restriction or account action.',
    ],
  },
  {
    title: '7. Delivery OTP, Open Box and Customer Verification',
    points: [
      'For delivery-security orders, delivery may require customer OTP confirmation after payment collection and package/product verification.',
      'For open-box eligible products, the package may be opened in front of the customer for product, brand, color, size and quantity verification.',
      'After successful OTP or open-box confirmation, return reasons based on preference, changed mind, wrong size after verification or wrong product after verification may be restricted.',
    ],
  },
  {
    title: '8. Return, Refund and Dispute Rules',
    points: [
      'Only genuine return reasons are allowed, such as manufacturing defect, damaged product, missing parts, wrong product where verification was not completed, non-working item, warranty issue or quality mismatch.',
      'The customer may be required to upload images, defect proof or short video before a return request is reviewed.',
      'Zylo-Buylo may review dispatch proof, delivery OTP, open-box proof, customer evidence and vendor history before approving or rejecting a return.',
      'False claims by vendor or customer may lead to account restrictions, payout hold or dispute review.',
    ],
  },
  {
    title: '9. Vendor Protection and Customer Protection',
    points: [
      'Zylo-Buylo may store dispatch proof, shipping label proof, delivery OTP proof, open-box proof and customer confirmation records for transparency.',
      'These records protect genuine vendors from false returns and protect customers from wrong, damaged or fake products.',
      'The admin team may use these records for order security, return review, payout decisions and fraud detection.',
    ],
  },
  {
    title: '10. Prohibited, Restricted and Certified Products',
    points: [
      'The vendor must not list any illegal, unsafe, prohibited, stolen, counterfeit, expired, recalled or restricted product.',
      'Products that require mandatory certification, license or approval must be listed only after the vendor has valid supporting documents.',
      'For regulated categories such as toys, electrical items, helmets, safety products, food, cosmetics, health products, medicines or similar goods, the vendor is responsible for BIS, ISI, FSSAI, drug, cosmetic, safety or other applicable compliance.',
      'Zylo-Buylo may ask for compliance documents before approval, after listing, during order review or after any customer/regulatory complaint.',
    ],
  },
  {
    title: '11. Packaging, Labelling and Legal Metrology',
    points: [
      'The vendor must ensure that packaged products carry legally required declarations such as MRP inclusive of taxes, net quantity, manufacturer/packer/importer details, country of origin, manufacturing or packing date, expiry or best-before date where applicable and customer care details.',
      'The vendor must not sell above MRP or misrepresent quantity, pack size, combo contents, warranty, expiry, ingredients, material, size, weight or product grade.',
      'If any product needs invoice, warranty card, user manual, safety instructions or batch/lot details, the vendor must include correct documents with the shipment.',
    ],
  },
  {
    title: '12. Customer Complaints, Recalls and Regulatory Cooperation',
    points: [
      'The vendor must cooperate with Zylo-Buylo for customer complaints, notices, product safety checks, regulatory inquiries, recalls, return investigation and dispute resolution.',
      'If a product is found unsafe, illegal, fake, expired, wrongly labelled or non-compliant, Zylo-Buylo may immediately hide the listing, stop orders, hold payout and ask the vendor for explanation or documents.',
      'The vendor must provide accurate seller contact and business information so customer or regulatory redressal can be handled properly.',
    ],
  },
  {
    title: '13. Records, Audit and Evidence Retention',
    points: [
      'Zylo-Buylo may store vendor registration details, agreement acceptance records, product listing data, catalog changes, dispatch proof, delivery proof, return evidence, payout records and communication history.',
      'The vendor must maintain purchase records, tax invoices, compliance certificates, brand authorization, warranty documents and courier proof for products sold on Zylo-Buylo.',
      'These records may be used for admin review, customer protection, vendor protection, fraud control, payout decisions, legal compliance and dispute handling.',
    ],
  },
  {
    title: '14. Data, Confidentiality and Platform Misuse',
    points: [
      'The vendor must use customer data only for fulfilling Zylo-Buylo orders and must not misuse, resell, contact outside platform, spam or disclose customer information.',
      'Vendor must not scrape platform data, bypass payment or delivery flow, manipulate ratings, create fake orders, misuse coupons, abuse COD or attempt unauthorized access.',
      'Commercial, technical, payout, customer and platform information shared through the vendor dashboard must be treated as confidential unless publicly available or legally required.',
    ],
  },
  {
    title: '15. Indemnity and Vendor Liability',
    points: [
      'The vendor is responsible for claims, losses, penalties, complaints, chargebacks, refunds, recalls or legal notices arising from false information, defective goods, counterfeit goods, non-compliance, wrong dispatch or breach of this agreement.',
      'The vendor agrees to protect and compensate Zylo-Buylo, customers and affected parties for vendor-caused losses, including product quality, tax, certification, intellectual property, packaging, labelling, warranty or delivery-related violations.',
      'Zylo-Buylo may recover such amounts from pending payouts or future vendor balances where allowed by platform policy and applicable law.',
    ],
  },
  {
    title: '16. Account Action and Policy Enforcement',
    points: [
      'Zylo-Buylo may reject products, remove listings, hold payout, limit COD orders, deactivate vendor dashboard access or suspend vendor account for policy violations.',
      'Repeated poor-quality listings, fake brand use, wrong dispatch, duplicate SKU misuse, abusive behavior or fraudulent activity may result in permanent account action.',
      'Zylo-Buylo may update this agreement or platform policies when required for business, legal, tax, payment, delivery or customer protection reasons.',
      'Clauses related to payout adjustment, records, confidentiality, indemnity, fraud review, customer protection and dispute resolution may continue even after vendor account closure.',
    ],
  },
];

export default function VendorAgreementPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-600">
                Vendor Legal Agreement
              </p>
              <h1 className="mt-3 text-3xl font-black">Zylo-Buylo Vendor Agreement</h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Version {VENDOR_AGREEMENT_VERSION}
              </p>
            </div>
            <Link
              href="/vendor/register"
              className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white"
            >
              Back to registration
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-pink-100 bg-pink-50 p-5 text-sm leading-6 text-slate-800">
            <p className="font-bold text-slate-950">Important acceptance rule</p>
            <p className="mt-2">
              A vendor can submit registration only after accepting this agreement. The acceptance is
              stored with the vendor record for admin review and vendor protection.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            {agreementSections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-black text-slate-950">{section.title}</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 p-5 text-sm leading-6 text-slate-700">
            <p className="font-bold text-slate-950">Vendor confirmation statement</p>
            <p className="mt-2">
              When a vendor selects the agreement checkbox during registration, the vendor confirms:
              &quot;I have read and accept the Zylo-Buylo Vendor Agreement, product quality rules,
              dispatch rules, COD payout rules, return rules and account policy rules.&quot;
            </p>
          </div>

          <Link
            href="/vendor/register"
            className="mt-8 inline-block rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white"
          >
            I understand, continue registration
          </Link>
        </div>
      </main>
    </div>
  );
}
