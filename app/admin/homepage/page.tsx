"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";
import FileUploadField from "@/components/forms/FileUploadField";
import {
  defaultHomepageContent,
  HomepageContent,
  HomepageHeroSlide,
  HomepageLinkItem,
  normalizeHomepageContent,
} from "@/lib/homepage-content";

const themeOptions = [
  { label: "Pearl luxury", theme: "bg-[#fff6fb]", panel: "bg-[#fff0f6]" },
  { label: "Gold luxury", theme: "bg-[#fff8ec]", panel: "bg-[#2a140c]" },
  { label: "Midnight premium", theme: "bg-[#f8f0ff]", panel: "bg-[#1f1024]" },
  { label: "Blue trust", theme: "bg-[#f4f9ff]", panel: "bg-[#eef6ff]" },
  { label: "Green fresh", theme: "bg-[#f0fdf4]", panel: "bg-[#e8f8ee]" },
  { label: "Rose festival", theme: "bg-[#fff1f2]", panel: "bg-[#4a102a]" },
];

function cloneDefaultContent() {
  return normalizeHomepageContent(defaultHomepageContent);
}

function updateArrayItem<T>(items: T[], index: number, patch: Partial<T>) {
  return items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...patch } : item,
  );
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLinks(items: HomepageLinkItem[]) {
  return items.map((item) => `${item.title} | ${item.href} | ${item.text || ""}`).join("\n");
}

function parseLinks(value: string, fallback: HomepageLinkItem[]) {
  const rows = splitLines(value).map((line) => {
    const [title = "", href = "", text = ""] = line.split("|").map((part) => part.trim());
    return { title, href, text };
  });

  return rows.length ? rows : fallback;
}

function joinBrands(items: HomepageContent["brandShortcuts"]) {
  return items.map((item) => `${item.name} | ${item.slug}`).join("\n");
}

function parseBrands(value: string, fallback: HomepageContent["brandShortcuts"]) {
  const rows = splitLines(value).map((line) => {
    const [name = "", slug = ""] = line.split("|").map((part) => part.trim());
    return { name, slug };
  });

  return rows.length ? rows : fallback;
}

function FieldLabel({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-stone-800">
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-medium text-stone-500">{hint}</span>}
    </label>
  );
}

function isVideoMedia(src: string) {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(src);
}

function BannerMediaPreview({
  src,
  alt,
  className = "",
  mediaClassName = "",
}: {
  src: string;
  alt: string;
  className?: string;
  mediaClassName?: string;
}) {
  if (!src) {
    return (
      <div className={`grid place-items-center bg-stone-100 text-xs font-bold text-stone-500 ${className}`}>
        No media selected
      </div>
    );
  }

  const mediaBaseClass = `relative z-10 h-full w-full object-contain p-2 sm:p-3 ${mediaClassName}`;

  if (isVideoMedia(src)) {
    return (
      <div className={`relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94),rgba(255,245,250,0.82)_48%,rgba(107,20,93,0.12))] ${className}`}>
        <video
          src={src}
          className={mediaBaseClass}
          muted
          loop
          playsInline
          controls
        />
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94),rgba(255,245,250,0.82)_48%,rgba(107,20,93,0.12))] ${className}`}>
      <img src={src} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-xl" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-[#6b145d]/10" />
      <img src={src} alt={alt} className={mediaBaseClass} />
    </div>
  );
}

function HeroSlidePreview({ slide }: { slide: HomepageHeroSlide }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-white/20 shadow-sm ${slide.theme}`}>
      <div className="relative grid overflow-hidden md:h-[185px] md:grid-cols-[0.82fr_1.18fr]">
        <div className="relative z-10 flex min-h-[165px] flex-col justify-center px-4 py-4 md:h-full md:min-h-0">
          <p className="w-fit rounded-full border border-[#ead7e8] bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#6b145d]">
            {slide.eyebrow || "Small label"}
          </p>
          <h4 className="mt-2 line-clamp-2 text-xl font-black leading-tight text-[#081225] md:text-2xl">
            {slide.title || "Banner title"}
            <span className="block bg-gradient-to-r from-[#e71876] via-[#8b1a7a] to-[#ff7a1a] bg-clip-text text-transparent">
              {slide.highlight || "Highlight line"}
            </span>
          </h4>
          <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-[#4b5563]">
            {slide.text || "Short description will appear here."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#6b145d] px-3 py-1.5 text-[10px] font-black uppercase text-white">
              {slide.primaryLabel || "Shop now"}
            </span>
            <span className="rounded-full border border-[#6b145d] bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase text-[#6b145d]">
              {slide.secondaryLabel || "Learn more"}
            </span>
          </div>
        </div>
        <div className="relative z-0 flex items-center px-4 pb-4 md:px-3 md:py-4">
          <div className={`h-[125px] w-full overflow-hidden rounded-2xl border border-white/70 bg-white/60 md:h-full ${slide.panel}`}>
            <BannerMediaPreview src={slide.image} alt={slide.imageAlt || slide.title} className="h-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminHomepagePage() {
  const [content, setContent] = useState<HomepageContent>(cloneDefaultContent);
  const [quickLinksText, setQuickLinksText] = useState("");
  const [utilityLinksText, setUtilityLinksText] = useState("");
  const [brandsText, setBrandsText] = useState("");
  const [dealCardsText, setDealCardsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const previewSlides = useMemo(
    () => content.heroSlides.filter((slide) => slide.title.trim()),
    [content.heroSlides],
  );

  useEffect(() => {
    async function loadContent() {
      try {
        const response = await fetch("/api/homepage-content", { cache: "no-store" });
        const data = await response.json();
        const normalized = normalizeHomepageContent(data.content);
        setContent(normalized);
        setQuickLinksText(joinLinks(normalized.quickShopLinks));
        setUtilityLinksText(joinLinks(normalized.utilityLinks));
        setBrandsText(joinBrands(normalized.brandShortcuts));
        setDealCardsText(joinLinks(normalized.dealCards));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Homepage content load failed.");
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, []);

  function updateHero(index: number, patch: Partial<HomepageHeroSlide>) {
    setContent((current) => ({
      ...current,
      heroSlides: updateArrayItem(current.heroSlides, index, patch),
    }));
  }

  function addHeroSlide() {
    setContent((current) => ({
      ...current,
      heroSlides: [
        ...current.heroSlides,
        {
          ...defaultHomepageContent.heroSlides[0],
          eyebrow: "New homepage media",
          title: "Premium marketplace banner",
          highlight: "Change image from admin",
          image: "/hero-marketplace-visual.png",
        },
      ].slice(0, 6),
    }));
  }

  async function saveContent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const finalContent = normalizeHomepageContent({
      ...content,
      quickShopLinks: parseLinks(quickLinksText, defaultHomepageContent.quickShopLinks),
      utilityLinks: parseLinks(utilityLinksText, defaultHomepageContent.utilityLinks),
      brandShortcuts: parseBrands(brandsText, defaultHomepageContent.brandShortcuts),
      dealCards: parseLinks(dealCardsText, defaultHomepageContent.dealCards),
    });

    try {
      const response = await fetch("/api/homepage-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: finalContent }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Homepage content save failed.");
        return;
      }

      const normalized = normalizeHomepageContent(data.content);
      setContent(normalized);
      setQuickLinksText(joinLinks(normalized.quickShopLinks));
      setUtilityLinksText(joinLinks(normalized.utilityLinks));
      setBrandsText(joinBrands(normalized.brandShortcuts));
      setDealCardsText(joinLinks(normalized.dealCards));
      setMessage("Homepage content saved. Live homepage will use these banners and buttons.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Homepage content save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <Navbar />

      <section className="border-b border-stone-200 bg-[#17130f] text-[#f8efe2]">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Link href="/admin/dashboard" className="text-sm font-bold text-[#d6b36a]">
            Back to admin dashboard
          </Link>
          <h1 className="mt-3 text-4xl font-bold">Homepage Content Control</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#d8c8af]">
            Change hero slider images, offer banners, discount text, top buttons and brands without editing code.
          </p>
        </div>
      </section>

      <form onSubmit={saveContent} className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {error && <p className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
        {message && <p className="border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">{message}</p>}

        {loading ? (
          <p className="bg-white p-8 text-center text-stone-500 shadow">Loading homepage content...</p>
        ) : (
          <>
            <section className="bg-white p-5 shadow">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Hero Banner System</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Homepage par ek premium banner frame rahega. Slide 1 ka text/buttons main banner control karta hai; sabhi slides ki images/videos right side me rotate hoti hain.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addHeroSlide}
                  className="rounded-sm border border-[#6b145d] px-4 py-2 text-sm font-black text-[#6b145d]"
                >
                  Add Slide
                </button>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-[#ead7e8] bg-[#fff8fc] p-4 text-sm text-stone-700 lg:grid-cols-4">
                <div>
                  <p className="font-black text-stone-950">Recommended image</p>
                  <p className="mt-1 text-xs">Desktop: 1600 x 520 px. Mobile safe: center product/person.</p>
                </div>
                <div>
                  <p className="font-black text-stone-950">Text limit</p>
                  <p className="mt-1 text-xs">Title 3-5 words, highlight 3-6 words, description max 1-2 lines.</p>
                </div>
                <div>
                  <p className="font-black text-stone-950">Color rule</p>
                  <p className="mt-1 text-xs">Use soft light/dark themes. Avoid very bright backgrounds behind text.</p>
                </div>
                <div>
                  <p className="font-black text-stone-950">Live size lock</p>
                  <p className="mt-1 text-xs">Homepage keeps one compact banner frame, around 3-4 inch visual height.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-5">
                {content.heroSlides.map((slide, index) => (
                  <div key={`${slide.title}-${index}`} className="rounded-xl border border-stone-200 bg-[#fffafc] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-black">Slide {index + 1}</h3>
                      <select
                        value={`${slide.theme}|${slide.panel}`}
                        onChange={(event) => {
                          const [theme, panel] = event.target.value.split("|");
                          updateHero(index, { theme, panel });
                        }}
                        className="rounded-lg border border-stone-300 p-2 text-sm"
                      >
                        {themeOptions.map((item) => (
                          <option key={item.label} value={`${item.theme}|${item.panel}`}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <FieldLabel label="Small label">
                        <input value={slide.eyebrow} onChange={(event) => updateHero(index, { eyebrow: event.target.value })} placeholder="Zylo-Buylo sale" className="rounded-lg border p-3" />
                      </FieldLabel>
                      <FieldLabel label="Main title">
                        <input value={slide.title} onChange={(event) => updateHero(index, { title: event.target.value })} placeholder="Shop smart, sell easy" className="rounded-lg border p-3" />
                      </FieldLabel>
                      <FieldLabel label="Highlight line">
                        <input value={slide.highlight} onChange={(event) => updateHero(index, { highlight: event.target.value })} placeholder="Trusted vendors. Better prices." className="rounded-lg border p-3" />
                      </FieldLabel>
                      <FieldLabel label="Banner image/video URL" hint="Yahan direct .jpg/.png/.webp image URL, public path like /hero-banner.png, ya direct .mp4 video URL dalen. Webpage link mat dalen.">
                        <input value={slide.image} onChange={(event) => updateHero(index, { image: event.target.value })} placeholder="/hero-banner.png or https://.../image.jpg" className="rounded-lg border p-3" />
                      </FieldLabel>
                      <div className="md:col-span-2">
                        <FileUploadField
                          label="Upload banner image/video"
                          purpose="homepage-banner"
                          accept="image/*,video/mp4,video/webm,video/quicktime"
                          onUploaded={(url) => updateHero(index, { image: url })}
                        />
                      </div>
                      <FieldLabel label="Primary button label">
                        <input value={slide.primaryLabel} onChange={(event) => updateHero(index, { primaryLabel: event.target.value })} placeholder="Shop Now" className="rounded-lg border p-3" />
                      </FieldLabel>
                      <FieldLabel label="Primary button route" hint="Example: /products or /products?offer=true. Image URL yahan nahi dalna hai.">
                        <input value={slide.primaryHref} onChange={(event) => updateHero(index, { primaryHref: event.target.value })} placeholder="/products" className="rounded-lg border p-3" />
                      </FieldLabel>
                      <FieldLabel label="Second button label">
                        <input value={slide.secondaryLabel} onChange={(event) => updateHero(index, { secondaryLabel: event.target.value })} placeholder="Become a seller" className="rounded-lg border p-3" />
                      </FieldLabel>
                      <FieldLabel label="Second button route" hint="Example: /supplier or /vendor/register.">
                        <input value={slide.secondaryHref} onChange={(event) => updateHero(index, { secondaryHref: event.target.value })} placeholder="/supplier" className="rounded-lg border p-3" />
                      </FieldLabel>
                      <FieldLabel label="Image alt text" hint="SEO/accessibility ke liye short image description." >
                        <input value={slide.imageAlt} onChange={(event) => updateHero(index, { imageAlt: event.target.value })} placeholder="Marketplace banner" className="rounded-lg border p-3 md:col-span-2" />
                      </FieldLabel>
                      <FieldLabel label="Banner description">
                        <textarea value={slide.text} onChange={(event) => updateHero(index, { text: event.target.value })} placeholder="Banner description" rows={3} className="rounded-lg border p-3 md:col-span-2" />
                      </FieldLabel>
                    </div>
                    <div className="mt-4 rounded-2xl border border-[#ead7e8] bg-white p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black text-stone-900">Compact media preview</p>
                        <p className="text-xs font-semibold text-stone-500">
                          Slide 1 text is used as main hero text; this slide image/video can rotate on homepage.
                        </p>
                      </div>
                      <HeroSlidePreview slide={slide} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <div className="bg-white p-5 shadow">
                  <h2 className="text-2xl font-black">Middle Promo Banner</h2>
                  <p className="mt-1 text-sm text-stone-600">Second screenshot ke marked image area ke liye.</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <FieldLabel label="Small label"><input value={content.promoBanner.eyebrow} onChange={(event) => setContent((current) => ({ ...current, promoBanner: { ...current.promoBanner, eyebrow: event.target.value } }))} placeholder="Luxury picks" className="rounded-lg border p-3" /></FieldLabel>
                    <FieldLabel label="Title"><input value={content.promoBanner.title} onChange={(event) => setContent((current) => ({ ...current, promoBanner: { ...current.promoBanner, title: event.target.value } }))} placeholder="Gold style, daily value" className="rounded-lg border p-3" /></FieldLabel>
                    <FieldLabel label="Button label"><input value={content.promoBanner.ctaLabel} onChange={(event) => setContent((current) => ({ ...current, promoBanner: { ...current.promoBanner, ctaLabel: event.target.value } }))} placeholder="Explore fashion" className="rounded-lg border p-3" /></FieldLabel>
                    <FieldLabel label="Button route"><input value={content.promoBanner.href} onChange={(event) => setContent((current) => ({ ...current, promoBanner: { ...current.promoBanner, href: event.target.value } }))} placeholder="/products?category=fashion" className="rounded-lg border p-3" /></FieldLabel>
                    <FieldLabel label="Banner image/video URL" hint="Direct image/video URL or /public-file.png path."><input value={content.promoBanner.image} onChange={(event) => setContent((current) => ({ ...current, promoBanner: { ...current.promoBanner, image: event.target.value } }))} placeholder="/hero-banner.png" className="rounded-lg border p-3 md:col-span-2" /></FieldLabel>
                    <div className="md:col-span-2">
                      <FileUploadField
                        label="Upload middle promo image/video"
                        purpose="homepage-banner"
                        accept="image/*,video/mp4,video/webm,video/quicktime"
                        onUploaded={(url) => setContent((current) => ({ ...current, promoBanner: { ...current.promoBanner, image: url } }))}
                      />
                    </div>
                    <FieldLabel label="Description"><textarea value={content.promoBanner.text} onChange={(event) => setContent((current) => ({ ...current, promoBanner: { ...current.promoBanner, text: event.target.value } }))} placeholder="Description" rows={3} className="rounded-lg border p-3 md:col-span-2" /></FieldLabel>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-[#2a140c]">
                    <div className="grid min-h-[180px] md:grid-cols-[1fr_0.85fr]">
                      <div className="flex flex-col justify-center p-5 text-white">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#facc15]">{content.promoBanner.eyebrow}</p>
                        <p className="mt-2 text-3xl font-black leading-tight">{content.promoBanner.title}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-white/80">{content.promoBanner.text}</p>
                      </div>
                      <div className="relative min-h-[160px]">
                        <BannerMediaPreview src={content.promoBanner.image} alt={content.promoBanner.imageAlt} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 shadow">
                  <h2 className="text-2xl font-black">Mega Discount Banner</h2>
                  <p className="mt-1 text-sm text-stone-600">Third screenshot ke discount percent/text ko yahan change karein.</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <FieldLabel label="Small label"><input value={content.discountBanner.eyebrow} onChange={(event) => setContent((current) => ({ ...current, discountBanner: { ...current.discountBanner, eyebrow: event.target.value } }))} placeholder="Mega Discount" className="rounded-lg border p-3" /></FieldLabel>
                    <FieldLabel label="Title"><input value={content.discountBanner.title} onChange={(event) => setContent((current) => ({ ...current, discountBanner: { ...current.discountBanner, title: event.target.value } }))} placeholder="Up to 70% Off" className="rounded-lg border p-3" /></FieldLabel>
                    <FieldLabel label="Discount percent"><input value={content.discountBanner.percent} onChange={(event) => setContent((current) => ({ ...current, discountBanner: { ...current.discountBanner, percent: event.target.value } }))} placeholder="70%" className="rounded-lg border p-3" /></FieldLabel>
                    <FieldLabel label="Button label"><input value={content.discountBanner.ctaLabel} onChange={(event) => setContent((current) => ({ ...current, discountBanner: { ...current.discountBanner, ctaLabel: event.target.value } }))} placeholder="Shop Deals" className="rounded-lg border p-3" /></FieldLabel>
                    <FieldLabel label="Button route"><input value={content.discountBanner.href} onChange={(event) => setContent((current) => ({ ...current, discountBanner: { ...current.discountBanner, href: event.target.value } }))} placeholder="/products?offer=true" className="rounded-lg border p-3" /></FieldLabel>
                    <FieldLabel label="Background image URL"><input value={content.discountBanner.image} onChange={(event) => setContent((current) => ({ ...current, discountBanner: { ...current.discountBanner, image: event.target.value } }))} placeholder="/hero-banner.png" className="rounded-lg border p-3" /></FieldLabel>
                    <div className="md:col-span-2">
                      <FileUploadField
                        label="Upload discount banner image/video"
                        purpose="homepage-banner"
                        accept="image/*,video/mp4,video/webm,video/quicktime"
                        onUploaded={(url) => setContent((current) => ({ ...current, discountBanner: { ...current.discountBanner, image: url } }))}
                      />
                    </div>
                    <FieldLabel label="Description"><textarea value={content.discountBanner.text} onChange={(event) => setContent((current) => ({ ...current, discountBanner: { ...current.discountBanner, text: event.target.value } }))} placeholder="Description" rows={3} className="rounded-lg border p-3 md:col-span-2" /></FieldLabel>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-[#6b145d] text-white">
                    <div className="grid min-h-[170px] md:grid-cols-[1fr_240px]">
                      <div className="p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ffd166]">{content.discountBanner.eyebrow}</p>
                        <p className="mt-2 text-3xl font-black">{content.discountBanner.title}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-white/85">{content.discountBanner.text}</p>
                      </div>
                      <div className="relative min-h-[150px]">
                        <BannerMediaPreview src={content.discountBanner.image} alt={content.discountBanner.imageAlt} />
                        <div className="absolute inset-0 grid place-items-center bg-[#6b145d]/45">
                          <span className="rounded-full border-4 border-white/40 bg-white/10 px-6 py-5 text-4xl font-black">{content.discountBanner.percent}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-5 shadow">
                  <h2 className="text-xl font-black">Top Buttons</h2>
                  <p className="mt-1 text-xs text-stone-500">Format: Title | Route | Small text</p>
                  <textarea value={utilityLinksText} onChange={(event) => setUtilityLinksText(event.target.value)} rows={7} className="mt-3 w-full rounded-lg border p-3 font-mono text-sm" />
                </div>

                <div className="bg-white p-5 shadow">
                  <h2 className="text-xl font-black">Quick Shop Buttons</h2>
                  <p className="mt-1 text-xs text-stone-500">Format: Title | Route | Optional text</p>
                  <textarea value={quickLinksText} onChange={(event) => setQuickLinksText(event.target.value)} rows={7} className="mt-3 w-full rounded-lg border p-3 font-mono text-sm" />
                </div>

                <div className="bg-white p-5 shadow">
                  <h2 className="text-xl font-black">Brands</h2>
                  <p className="mt-1 text-xs text-stone-500">Format: Brand Name | brand-slug</p>
                  <textarea value={brandsText} onChange={(event) => setBrandsText(event.target.value)} rows={8} className="mt-3 w-full rounded-lg border p-3 font-mono text-sm" />
                </div>

                <div className="bg-white p-5 shadow">
                  <h2 className="text-xl font-black">Deal Cards</h2>
                  <p className="mt-1 text-xs text-stone-500">Format: Title | Route | Text</p>
                  <textarea value={dealCardsText} onChange={(event) => setDealCardsText(event.target.value)} rows={5} className="mt-3 w-full rounded-lg border p-3 font-mono text-sm" />
                </div>
              </div>
            </section>

            <section className="bg-white p-5 shadow">
              <h2 className="text-2xl font-black">Live Preview Summary</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {previewSlides.map((slide, index) => (
                  <div key={`${slide.title}-preview-${index}`} className="rounded-xl border border-[#ead7e8] bg-[#fff8fc] p-4">
                    <p className="text-xs font-black uppercase text-[#6b145d]">{slide.eyebrow}</p>
                    <p className="mt-2 text-lg font-black">{slide.title}</p>
                    <p className="mt-1 text-sm text-stone-600">{slide.highlight}</p>
                    <p className="mt-3 truncate text-xs text-stone-500">{slide.image}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border border-stone-200 bg-white p-4 shadow-2xl">
              <Link href="/" className="rounded-sm border border-stone-300 px-5 py-3 text-sm font-black">
                View Homepage
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="rounded-sm bg-[#6b145d] px-7 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Homepage Content"}
              </button>
            </div>
          </>
        )}
      </form>
    </main>
  );
}
