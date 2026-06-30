# Zylo-Buylo Legal and Policy Review Checklist

Status: Ready for professional legal/compliance review
Last prepared: 2026-06-29

This file is an internal review guide. It is not legal advice and does not replace review by a lawyer, tax consultant, payment compliance specialist, or ecommerce compliance professional.

## Public Policy Pages

| Policy area | Public route | Main file | Purpose |
| --- | --- | --- | --- |
| Terms and Conditions | `/terms` | `app/terms/page.tsx` | Customer ordering, COD, return, vendor and marketplace terms |
| COD Policy | `/cod-policy` | `app/cod-policy/page.tsx` | COD payment, delivery OTP, collection and refund rules |
| Return Policy | `/return-policy` | `app/return-policy/page.tsx` | Genuine return reasons, blocked reasons and evidence rules |
| Vendor Agreement | `/vendor-agreement` | `app/vendor-agreement/page.tsx` | Vendor duties, KYC, catalog, payout, dispatch, return and account rules |
| Privacy Policy | `/privacy` | `app/privacy/page.tsx` | Customer/vendor data use, documents, order proof, retention and sharing |

## Acceptance Records To Review

| Flow | Acceptance text/source | Stored evidence |
| --- | --- | --- |
| Vendor registration | Vendor agreement checkbox in `app/vendor/register/page.tsx` | Agreement accepted flag, agreement version, accepted timestamp, IP address and user agent metadata |
| Customer checkout | Terms and COD checkboxes in `app/checkout/page.tsx` | Order placement requires accepted terms; COD requires COD terms |
| Delivery verification | OTP and open-box confirmation in order flow | Delivery OTP, open-box confirmation, product match checklist |
| Return request | Return evidence form in `app/order/[id]/page.tsx` | Return reason, details, product images, defect images, video evidence and risk assessment |

## Business Rules Requiring Professional Review

1. Marketplace role
   - Confirm Zylo-Buylo wording correctly represents the platform as a marketplace/intermediary where applicable.
   - Confirm vendor responsibility wording is strong enough for product quality, labeling, packaging, tax and dispatch.

2. Vendor onboarding and KYC
   - Confirm required vendor KYC documents are appropriate: mobile, email, PAN, Aadhaar, GST where applicable, bank proof and business address.
   - Confirm whether Aadhaar handling needs extra consent, masking, retention limits or security wording.

3. Product listing compliance
   - Confirm vendor obligations for product title, image, MRP, GST, HSN, country of origin, manufacturer/packer/importer and expiry/best-before where applicable.
   - Confirm restricted/prohibited product categories needed for launch.

4. COD policy
   - Confirm customer must pay before delivery OTP completion.
   - Confirm COD refund method wording: bank/UPI/wallet only, no doorstep cash refund.
   - Confirm COD refusal, fake order and risk restriction wording.

5. Delivery OTP and open-box delivery
   - Confirm OTP/open-box flow is legally acceptable and operationally clear.
   - Confirm “verified delivery” and “customer confirmation” wording does not unfairly remove genuine defect/warranty rights.

6. Return and refund policy
   - Confirm blocked return reasons are acceptable after verified delivery.
   - Confirm allowed reasons cover genuine issues: defect, damage, not working, missing parts, warranty, hidden transit damage, fake product suspected and quality mismatch.
   - Confirm mandatory image/video evidence wording is fair and enforceable.
   - Confirm category-specific rules for fashion, electronics, spare parts, beauty/personal care, baby products and groceries.

7. Vendor payout and deductions
   - Confirm payout hold/adjustment wording for COD reconciliation, returns, refunds, fraud review, wrong dispatch and penalties.
   - Confirm whether vendor payout timeline must be stated clearly.
   - Confirm tax invoice/GST responsibilities between vendor and marketplace.

8. Privacy and data retention
   - Confirm whether the draft privacy policy page is complete for full launch.
   - Confirm handling of customer address, phone, email, vendor documents, bank details, return evidence, dispatch photos and OTP logs.
   - Confirm retention period and deletion request process.

9. Disputes, jurisdiction and notices
   - Confirm governing law, court jurisdiction, dispute escalation path and notice contact details.
   - Confirm support email/phone and business legal entity details are complete in admin business profile.

10. Payment gateway and refunds
    - Confirm Razorpay live payment, webhook, refund and chargeback language.
    - Confirm whether payment gateway terms must be referenced in customer terms.

## Evidence System To Explain To Reviewer

The system can store or display:

- Vendor agreement acceptance metadata.
- Product variant size, color, SKU and stock details.
- COD terms accepted during checkout.
- Courier company and tracking/AWB number.
- Dispatch product images, packed product images and shipping label proof.
- Delivery OTP status.
- Open-box/product-match confirmation.
- Return request reason and mandatory evidence.
- Risk assessment for return review.
- Admin refund/return decision and note.
- Vendor payout/refund adjustment records.

## Open Legal Questions

Use these questions with the professional reviewer:

1. Is the vendor agreement acceptance flow sufficient as an electronic contract?
2. Should customers also accept a versioned customer terms record at checkout?
3. Do we need a separate privacy policy page before launch?
4. Is Aadhaar collection necessary, or should the system avoid Aadhaar unless legally required?
5. Are COD collection and OTP/open-box rules worded safely?
6. Can “wrong product” be blocked after verified open-box/product-match confirmation while still allowing genuine defect claims?
7. What product categories should be prohibited or restricted on Zylo-Buylo?
8. What refund timelines must be promised to customers?
9. What vendor payout timeline and deduction rules must be stated?
10. Which business entity name, address, GST/PAN and support contact must be shown publicly?

## Recommended Before Public Launch

- Have the draft Privacy Policy page reviewed and finalize support/legal contact details.
- Add the final business legal entity name, registered address, support email, support phone, GST/PAN where applicable.
- Have vendor agreement, return policy, COD policy and customer terms reviewed by a professional.
- Keep the reviewed policy version/date in release notes.
- Do one live order test after policy review to confirm customer-facing wording matches the real checkout/order flow.
