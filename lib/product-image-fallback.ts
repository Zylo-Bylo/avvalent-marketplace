export const PRODUCT_PLACEHOLDER_IMAGE = "/product-placeholder.svg";

const PLACEHOLDER_IMAGE_HOSTS = new Set([
  "placehold.co",
  "placeholder.com",
  "via.placeholder.com",
]);

export function isExternalPlaceholderImage(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    return (
      PLACEHOLDER_IMAGE_HOSTS.has(host) ||
      host.endsWith(".placehold.co") ||
      host.endsWith(".placeholder.com")
    );
  } catch {
    return false;
  }
}

export function normalizeProductImages(images: unknown) {
  const validImages = Array.isArray(images)
    ? images
        .filter((image): image is string => typeof image === "string")
        .map((image) => image.trim())
        .filter((image) => image && !isExternalPlaceholderImage(image))
    : [];

  return validImages.length > 0 ? validImages : [PRODUCT_PLACEHOLDER_IMAGE];
}

export function normalizeProductImageFallback<T extends { images?: unknown }>(
  product: T,
) {
  return {
    ...product,
    images: normalizeProductImages(product.images),
  };
}
