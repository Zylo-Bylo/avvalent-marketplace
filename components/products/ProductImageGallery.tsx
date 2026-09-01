"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type ProductImageGalleryProps = {
  images: string[];
  productName: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
  fallbackImage?: string;
  presentationContext?: string;
};

export type GalleryImageItem = {
  src: string;
  originalIndex: number;
  isFallback: boolean;
};

export const PRODUCT_GALLERY_FALLBACK_IMAGE = "/product-placeholder.svg";

export type ProductGalleryPresentation = {
  mode: "fashion" | "balanced" | "contained";
  mobileFrameClass: string;
  singleFrameClass: string;
  pairFrameClass: string;
  mosaicFrameClass: string;
  imageClassName: string;
};

export function getProductGalleryPresentation(
  context = "",
): ProductGalleryPresentation {
  const normalized = context.toLowerCase();
  const isFashion =
    /\b(apparel|fashion|clothing|women|men|kids|kurti|kurtis|shirt|shirts|t-?shirt|dress|saree|lehenga|gown|top|tops|jean|jeans|trouser|trousers|pant|pants|ethnic|wear)\b/.test(
      normalized,
    );
  const isContained =
    /\b(beauty|face wash|cream|serum|lotion|oil|shampoo|electronics|mobile|phone|laptop|home|living|decor|appliance)\b/.test(
      normalized,
    );

  if (isFashion) {
    return {
      mode: "fashion",
      mobileFrameClass: "aspect-[4/5]",
      singleFrameClass: "h-[560px] xl:h-[620px] 2xl:h-[680px]",
      pairFrameClass: "h-[540px] xl:h-[600px] 2xl:h-[650px]",
      mosaicFrameClass: "h-[580px] xl:h-[640px] 2xl:h-[700px]",
      imageClassName: "object-cover object-top",
    };
  }

  if (isContained) {
    return {
      mode: "contained",
      mobileFrameClass: "aspect-square",
      singleFrameClass: "h-[460px] xl:h-[500px] 2xl:h-[540px]",
      pairFrameClass: "h-[440px] xl:h-[480px] 2xl:h-[520px]",
      mosaicFrameClass: "h-[500px] xl:h-[540px] 2xl:h-[580px]",
      imageClassName: "object-contain p-4",
    };
  }

  return {
    mode: "balanced",
    mobileFrameClass: "aspect-[4/5]",
    singleFrameClass: "h-[500px] xl:h-[560px] 2xl:h-[600px]",
    pairFrameClass: "h-[500px] xl:h-[560px] 2xl:h-[600px]",
    mosaicFrameClass: "h-[540px] xl:h-[600px] 2xl:h-[640px]",
    imageClassName: "object-contain p-2",
  };
}

export function getRecoverableGalleryImages(
  images: string[],
  failedSources: Iterable<string> = [],
  fallbackImage = PRODUCT_GALLERY_FALLBACK_IMAGE,
): GalleryImageItem[] {
  const failed = new Set(Array.from(failedSources).map((source) => source.trim()).filter(Boolean));
  const unique = Array.from(
    new Set(
      (images || [])
        .map((image) => String(image || "").trim())
        .filter(Boolean),
    ),
  );
  const usable = unique
    .map((src, originalIndex) => ({ src, originalIndex, isFallback: src === fallbackImage }))
    .filter((item) => item.isFallback || !failed.has(item.src));

  return usable.length
    ? usable
    : [{ src: fallbackImage, originalIndex: 0, isFallback: true }];
}

export function getVisibleGalleryImages(items: GalleryImageItem[]) {
  const limit = items.length >= 4 ? 5 : items.length;
  return items.slice(0, limit);
}

export default function ProductImageGallery({
  images,
  productName,
  selectedIndex,
  onSelect,
  fallbackImage = PRODUCT_GALLERY_FALLBACK_IMAGE,
  presentationContext = "",
}: ProductImageGalleryProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [failedSources, setFailedSources] = useState<Set<string>>(() => new Set());
  const galleryImages = useMemo(
    () => getRecoverableGalleryImages(images, failedSources, fallbackImage),
    [failedSources, fallbackImage, images],
  );
  const presentation = useMemo(
    () => getProductGalleryPresentation(`${productName} ${presentationContext}`),
    [presentationContext, productName],
  );
  const visibleImages = getVisibleGalleryImages(galleryImages);
  const selectedPosition = galleryImages.findIndex((item) => item.originalIndex === selectedIndex);
  const activePosition = selectedPosition >= 0 ? selectedPosition : 0;
  const activeItem = galleryImages[activePosition] || galleryImages[0];
  const moreCount = Math.max(0, galleryImages.length - visibleImages.length);

  useEffect(() => {
    if (selectedPosition >= 0 || !galleryImages[0]) return;
    onSelect(galleryImages[0].originalIndex);
  }, [galleryImages, onSelect, selectedPosition]);

  useEffect(() => {
    if (!viewerOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setViewerOpen(false);
      }
      if (event.key === "ArrowRight") {
        move(1);
      }
      if (event.key === "ArrowLeft") {
        move(-1);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function markImageFailed(src: string) {
    if (!src || src === fallbackImage) return;
    setFailedSources((current) => {
      if (current.has(src)) return current;
      const next = new Set(current);
      next.add(src);
      return next;
    });
  }

  function selectImage(item: GalleryImageItem) {
    onSelect(item.originalIndex);
    setViewerOpen(true);
  }

  function move(direction: 1 | -1) {
    const nextPosition = (activePosition + direction + galleryImages.length) % galleryImages.length;
    onSelect(galleryImages[nextPosition].originalIndex);
  }

  function renderGalleryImage(item: GalleryImageItem, index: number, priority = false) {
    return (
      <Image
        src={item.src || fallbackImage}
        alt={item.isFallback ? `${productName} image unavailable` : `${productName} image ${index + 1}`}
        fill
        priority={priority}
        sizes="(min-width: 1440px) 52vw, (min-width: 1024px) 58vw, (min-width: 768px) 70vw, 100vw"
        className={`${presentation.imageClassName} transition duration-300 group-hover:scale-[1.02]`}
        onError={() => markImageFailed(item.src)}
      />
    );
  }

  return (
    <>
      <section className="lg:sticky lg:top-28">
        <div className="md:hidden">
          <div className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl border border-[#eadfce] bg-[#fffaf1]">
            {galleryImages.map((item, index) => (
              <button
                key={`${item.src}-${item.originalIndex}`}
                type="button"
                onClick={() => selectImage(item)}
                className={`relative ${presentation.mobileFrameClass} w-full flex-none snap-center overflow-hidden`}
                aria-label={`Open product image ${index + 1} of ${galleryImages.length}`}
              >
                {renderGalleryImage(item, index, index === 0)}
              </button>
            ))}
          </div>
          {galleryImages.length > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              {galleryImages.map((item, index) => (
                <button
                  key={`${item.src}-dot-${item.originalIndex}`}
                  type="button"
                  onClick={() => onSelect(item.originalIndex)}
                  className={`h-2 rounded-full transition ${
                    activePosition === index ? "w-6 bg-[#1f1b16]" : "w-2 bg-[#cabca6]"
                  }`}
                  aria-label={`Show image ${index + 1}`}
                />
              ))}
              <span className="ml-2 text-xs text-[#6f6659]">
                {activePosition + 1}/{galleryImages.length}
              </span>
            </div>
          )}
        </div>

        <div className="hidden md:block">
          {galleryImages.length === 1 ? (
            <button
              type="button"
              onClick={() => selectImage(galleryImages[0])}
              className={`group relative block w-full overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffaf1] ${presentation.singleFrameClass}`}
              aria-label="Open product image 1 of 1"
            >
              {renderGalleryImage(galleryImages[0], 0, true)}
            </button>
          ) : galleryImages.length === 2 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleImages.map((item, index) => (
                <button
                  key={`${item.src}-${item.originalIndex}`}
                  type="button"
                  onClick={() => selectImage(item)}
                  className={`group relative overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffaf1] ${presentation.pairFrameClass}`}
                  aria-label={`Open product image ${index + 1} of ${galleryImages.length}`}
                >
                  {renderGalleryImage(item, index, index === 0)}
                </button>
              ))}
            </div>
          ) : (
            <div className={`grid gap-3 md:grid-cols-[minmax(0,1.58fr)_minmax(0,1fr)] ${presentation.mosaicFrameClass}`}>
              <button
                type="button"
                onClick={() => selectImage(visibleImages[0])}
                className="group relative overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffaf1]"
                aria-label={`Open product image 1 of ${galleryImages.length}`}
              >
                {renderGalleryImage(visibleImages[0], 0, true)}
              </button>

              <div
                className={`grid min-h-0 gap-3 ${
                  visibleImages.length === 3
                    ? "grid-cols-1 grid-rows-2"
                    : "grid-cols-2 grid-rows-2"
                }`}
              >
                {visibleImages.slice(1, 5).map((item, offset) => {
                  const index = offset + 1;
                  return (
                    <button
                      key={`${item.src}-${item.originalIndex}`}
                      type="button"
                      onClick={() => selectImage(item)}
                      className="group relative min-h-0 overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fffaf1]"
                      aria-label={`Open product image ${index + 1} of ${galleryImages.length}`}
                    >
                      {renderGalleryImage(item, index)}
                      {moreCount > 0 && index === visibleImages.length - 1 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">
                          +{moreCount} more
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {galleryImages.length > 1 && (
          <div className="mt-3 hidden items-center gap-3 md:flex">
            <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-1">
              {galleryImages.slice(0, 7).map((item, index) => (
                <button
                  key={`thumb-${item.src}-${item.originalIndex}`}
                  type="button"
                  onClick={() => onSelect(item.originalIndex)}
                  className={`relative h-16 w-16 flex-none overflow-hidden rounded-xl border bg-[#fffaf1] transition ${
                    activePosition === index
                      ? "border-[#b88935] ring-2 ring-[#f0d39a]"
                      : "border-[#eadfce] hover:border-[#b88935]"
                  }`}
                  aria-label={`Show image ${index + 1}`}
                >
                  <Image
                    src={item.src || fallbackImage}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                    onError={() => markImageFailed(item.src)}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setViewerOpen(true)}
              className="flex-none rounded-xl border border-[#d8c7aa] bg-white px-4 py-3 text-sm font-medium text-[#2a241d] shadow-sm transition hover:border-[#a7833f]"
            >
              View all photos
            </button>
          </div>
        )}
      </section>

      {viewerOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Product image viewer"
        >
          <div className="flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-[#fffaf1] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#eadfce] bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.14em] text-[#9b7a2f]">
                  Product photos
                </p>
                <p className="line-clamp-1 text-sm font-semibold text-[#1f1b16]">
                  {productName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#f4ead9] px-3 py-1 text-xs font-medium text-[#4a4035]">
                  {activePosition + 1} / {galleryImages.length}
                </span>
                <button
                  type="button"
                  onClick={() => setZoomed((current) => !current)}
                  className="rounded-full border border-[#d8c7aa] px-3 py-2 text-sm font-medium text-[#2a241d]"
                >
                  {zoomed ? "Fit" : "Zoom"}
                </button>
                <button
                  type="button"
                  onClick={() => setViewerOpen(false)}
                  className="rounded-full bg-[#1f1b16] px-4 py-2 text-sm font-medium text-white"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-auto bg-[#f6efe4]">
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => move(-1)}
                    className="absolute left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl text-[#1f1b16] shadow"
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => move(1)}
                    className="absolute right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl text-[#1f1b16] shadow"
                    aria-label="Next image"
                  >
                    ›
                  </button>
                </>
              )}
              <div className={`relative mx-auto h-full min-h-[420px] ${zoomed ? "w-[1400px]" : "w-full"}`}>
                <Image
                  src={activeItem?.src || fallbackImage}
                  alt={activeItem?.isFallback ? `${productName} image unavailable` : `${productName} image ${activePosition + 1}`}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  onError={() => activeItem && markImageFailed(activeItem.src)}
                />
              </div>
            </div>

            {galleryImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto border-t border-[#eadfce] bg-white p-3">
                {galleryImages.map((item, index) => (
                  <button
                    key={`viewer-${item.src}-${item.originalIndex}`}
                    type="button"
                    onClick={() => onSelect(item.originalIndex)}
                    className={`relative h-16 w-16 flex-none overflow-hidden rounded-xl border bg-[#fffaf1] ${
                      activePosition === index
                        ? "border-[#9b7a2f] ring-2 ring-[#e6d3a5]"
                        : "border-[#eadfce]"
                    }`}
                    aria-label={`View image ${index + 1}`}
                  >
                    <Image
                      src={item.src || fallbackImage}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-contain"
                      onError={() => markImageFailed(item.src)}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
