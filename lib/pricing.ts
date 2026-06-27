export type MarketplacePricingInput = {
  price?: number | string | null;
  mrp?: number | string | null;
  vendorPrice?: number | string | null;
  sellingPrice?: number | string | null;
  discountPercent?: number | string | null;
  platformCommissionPercent?: number | string | null;
  packagingCharge?: number | string | null;
  weightGrams?: number | string | null;
  packageSize?: string | null;
  fragile?: boolean | string | null;
  shippingCharge?: number | string | null;
  codCharge?: number | string | null;
};

export type MarketplacePricing = {
  mrp: number;
  vendorPrice: number;
  sellingPrice: number;
  discountPercent: number;
  discountAmount: number;
  platformCommissionPercent: number;
  platformCommissionAmount: number;
  packagingCharge: number;
  packageSize: string;
  weightGrams: number;
  fragile: boolean;
  shippingCharge: number;
  codCharge: number;
  finalCustomerPrice: number;
  vendorPayout: number;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function percent(value: number) {
  return Math.round(value * 10) / 10;
}

function toBoolean(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  return value === "true" || value === "1" || value === "yes";
}

export const PACKAGE_SIZE_OPTIONS = [
  { value: "AUTO", label: "Auto by weight", charge: null },
  { value: "TINY", label: "Tiny - up to 250g", charge: 8 },
  { value: "SMALL", label: "Small - 251g to 500g", charge: 12 },
  { value: "STANDARD", label: "Standard - 501g to 1kg", charge: 20 },
  { value: "MEDIUM", label: "Medium - 1kg to 2kg", charge: 35 },
  { value: "LARGE", label: "Large - 2kg to 5kg", charge: 60 },
  { value: "HEAVY", label: "Heavy - 5kg to 10kg", charge: 100 },
  { value: "EXTRA_HEAVY", label: "Extra heavy - 10kg+", charge: 150 },
] as const;

export function getPackageSizeFromWeight(weightGrams: number) {
  if (weightGrams <= 250) return "TINY";
  if (weightGrams <= 500) return "SMALL";
  if (weightGrams <= 1000) return "STANDARD";
  if (weightGrams <= 2000) return "MEDIUM";
  if (weightGrams <= 5000) return "LARGE";
  if (weightGrams <= 10000) return "HEAVY";
  return "EXTRA_HEAVY";
}

export function calculatePackagingCharge(input: {
  weightGrams?: number | string | null;
  packageSize?: string | null;
  fragile?: boolean | string | null;
}) {
  const weightGrams = Math.max(0, toNumber(input.weightGrams) ?? 0);
  const requestedSize = input.packageSize || "AUTO";
  const packageSize =
    requestedSize === "AUTO" ? getPackageSizeFromWeight(weightGrams) : requestedSize;
  const option = PACKAGE_SIZE_OPTIONS.find((item) => item.value === packageSize);
  const baseCharge = option?.charge ?? 20;
  const fragile = toBoolean(input.fragile);
  const fragileCharge = fragile ? 30 : 0;

  return {
    packageSize,
    weightGrams,
    fragile,
    charge: money(baseCharge + fragileCharge),
  };
}

export function calculateDeliveryCharge(input: {
  weightGrams?: number | string | null;
}) {
  const weightGrams = Math.max(0, toNumber(input.weightGrams) ?? 0);

  if (weightGrams <= 500) return 40;
  if (weightGrams <= 1000) return 60;
  if (weightGrams <= 2000) return 80;
  if (weightGrams <= 5000) return 120;
  if (weightGrams <= 10000) return 180;
  return 250;
}

export function calculateMarketplacePricing(
  input: MarketplacePricingInput,
): MarketplacePricing {
  const commissionPercent = Math.max(
    0,
    toNumber(input.platformCommissionPercent) ?? 10,
  );
  const packaging = calculatePackagingCharge({
    weightGrams: input.weightGrams,
    packageSize: input.packageSize,
    fragile: input.fragile,
  });
  const packagingCharge = Math.max(
    0,
    toNumber(input.packagingCharge) ?? packaging.charge,
  );
  const shippingCharge = Math.max(
    0,
    toNumber(input.shippingCharge) ??
      calculateDeliveryCharge({ weightGrams: packaging.weightGrams }),
  );
  const codCharge = Math.max(0, toNumber(input.codCharge) ?? 0);
  const existingPrice = Math.max(0, toNumber(input.price) ?? 0);
  const vendorPrice = Math.max(
    0,
    toNumber(input.vendorPrice) ??
      toNumber(input.sellingPrice) ??
      existingPrice,
  );
  const commissionAmount = money((vendorPrice * commissionPercent) / 100);
  const floorPrice = money(
    vendorPrice + commissionAmount + packagingCharge + shippingCharge + codCharge,
  );
  const providedMrp = toNumber(input.mrp);
  const mrp = money(Math.max(providedMrp ?? floorPrice, floorPrice));
  const providedSellingPrice =
    toNumber(input.sellingPrice) ?? (input.vendorPrice ? null : existingPrice);
  const providedDiscountPercent = toNumber(input.discountPercent);
  const discountedPrice =
    providedDiscountPercent !== null && mrp > 0
      ? money(mrp - (mrp * Math.max(0, providedDiscountPercent)) / 100)
      : null;
  const finalCustomerPrice = money(
    Math.max(providedSellingPrice ?? discountedPrice ?? floorPrice, floorPrice),
  );
  const discountAmount = money(Math.max(0, mrp - finalCustomerPrice));
  const discountPercent =
    mrp > 0 ? percent((discountAmount / mrp) * 100) : 0;

  return {
    mrp,
    vendorPrice: money(vendorPrice),
    sellingPrice: finalCustomerPrice,
    discountPercent,
    discountAmount,
    platformCommissionPercent: commissionPercent,
    platformCommissionAmount: commissionAmount,
    packagingCharge,
    packageSize: packaging.packageSize,
    weightGrams: packaging.weightGrams,
    fragile: packaging.fragile,
    shippingCharge,
    codCharge,
    finalCustomerPrice,
    vendorPayout: money(vendorPrice),
  };
}

export function formatRupees(value: number | string | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}
