export const VENDOR_AGREEMENT_VERSION = '2026-06-23';
export const CUSTOMER_TERMS_VERSION = '2026-06-23';

export function getVendorAgreementMetadata(input?: {
  acceptedAt?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  return {
    vendor_agreement_accepted: true,
    vendor_agreement_version: VENDOR_AGREEMENT_VERSION,
    vendor_agreement_accepted_at: input?.acceptedAt || new Date().toISOString(),
    vendor_agreement_ip_address: input?.ipAddress || null,
    vendor_agreement_user_agent: input?.userAgent || null,
  };
}

export function hasAcceptedCurrentVendorAgreement(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const values = metadata as Record<string, unknown>;
  return (
    values.vendor_agreement_accepted === true &&
    values.vendor_agreement_version === VENDOR_AGREEMENT_VERSION
  );
}
