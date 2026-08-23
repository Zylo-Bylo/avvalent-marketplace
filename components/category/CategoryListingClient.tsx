"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import MobileNavbar from "@/components/MobileNavbar";
import Navbar from "@/components/navbar/Navbar";
import {
  getCategoryListingConfig,
  getDefaultSizes,
  getSizeGuideLabel,
} from "@/lib/categoryFilters";
import type { CategoryFilter, CategoryShortcut } from "@/lib/categoryFilters";
import { findCategoryPart } from "@/data/category-tree";
import {
  cacheCategoryListing,
  cachePublicCategoryTree,
  getCachedCategoryListing,
  getCachedPublicCategoryTree,
} from "@/lib/category-listing-cache";
import {
  categoryPlaceholderImage,
  findCategoryNodeByAnySlug,
  findCategoryNodeByPath,
  getCategoryDesktopBanner,
  getCategoryHref,
  getCategoryMobileBanner,
  normalizePublicCategoryTree,
  type PublicCategoryNode,
} from "@/lib/public-category-navigation";
import { useWishlistStore } from "@/store/wishlist-store";

type Product = {
  id: string;
  slug?: string;
  name: string;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  inventory?: number | null;
  images: string[];
  variants?: Array<{
    id: string;
    sizeLabel?: string | null;
    numericSize?: string | null;
    stockQuantity: number;
  }>;
  category?: {
    name: string;
  } | null;
  subcategory?: {
    name: string;
  } | null;
  vendor?: {
    storeName: string;
  } | null;
};

type CategoryListingClientProps = {
  mainSlug: string;
  groupSlug?: string;
  partSlug: string;
};

type DynamicTemplateField = {
  name?: string;
  label?: string;
  fieldType?: string;
  dropdownValues?: string[];
  options?: string[];
  filterable?: boolean;
  displayOrder?: number;
};

type DynamicTemplate = {
  specTemplate?: {
    fields?: DynamicTemplateField[];
    filterConfig?: string[];
  };
};

const fallbackImage = "https://placehold.co/900x1200/png?text=ZYLO+BUYLO";

function titleFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function metric(seed: string, min: number, range: number) {
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return min + (total % range);
}

function getProductHref(product: Product) {
  return `/products/${product.id}`;
}

function getStockSignal(product: Product) {
  const available = Number(product.inventory ?? 0);

  if (available <= 0) {
    return {
      label: "Out of Stock",
      className: "bg-stone-200 text-stone-700",
    };
  }

  if (available <= 3) {
    return {
      label: `Only ${available} left`,
      className: "bg-red-100 text-red-700",
    };
  }

  if (available <= 10) {
    return {
      label: "Low Stock",
      className: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "In Stock",
    className: "bg-emerald-100 text-emerald-700",
  };
}

function getProductSizes(product: Product, fallbackSizes: string[]) {
  const variantSizes =
    product.variants
      ?.map((variant) => variant.sizeLabel || variant.numericSize)
      .filter((value): value is string => Boolean(value))
      .filter((value, index, list) => list.indexOf(value) === index)
      .slice(0, 5) || [];

  return variantSizes.length > 0 ? variantSizes : fallbackSizes;
}

function getActiveChips(filters: Record<string, string>, filterDefs: CategoryFilter[]) {
  return Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => {
      const filter = filterDefs.find((item) => item.key === key);
      const option = filter?.options.find((item) => item.value === value);
      return {
        key,
        label: `${filter?.label || key}: ${option?.label || value}`,
      };
    });
}

function toDynamicOption(label: string) {
  return {
    label,
    value: label.trim(),
  };
}

const dynamicPriceFilter: CategoryFilter = {
  key: "price",
  label: "Price",
  type: "price",
  options: [
    { label: "Under Rs. 499", value: "under-499", maxPrice: "499" },
    { label: "Under Rs. 999", value: "under-999", maxPrice: "999" },
    { label: "Rs. 1000 - Rs. 1999", value: "1000-1999", minPrice: "1000", maxPrice: "1999" },
    { label: "Rs. 2000+", value: "2000-plus", minPrice: "2000" },
  ],
};

const dynamicSortFilter: CategoryFilter = {
  key: "sort",
  label: "Sort By",
  type: "sort",
  options: [
    { label: "Popular", value: "popular" },
    { label: "Newest", value: "newest" },
    { label: "Price: Low to High", value: "price-asc" },
    { label: "Price: High to Low", value: "price-desc" },
  ],
};

function filtersFromTemplate(template: DynamicTemplate | null): CategoryFilter[] {
  const fields = template?.specTemplate?.fields || [];
  const filterConfig = new Set(template?.specTemplate?.filterConfig || []);
  const fieldFilters = fields
    .filter((field) => field.filterable || (field.name && filterConfig.has(field.name)))
    .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
    .map((field) => {
      const rawOptions = field.dropdownValues?.length ? field.dropdownValues : field.options || [];
      return {
        key: field.name || String(field.label || "").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label: field.label || field.name || "Specification",
        options: rawOptions.filter(Boolean).map(toDynamicOption),
      };
    })
    .filter((filter) => filter.key && filter.options.length > 0);

  return [...fieldFilters, dynamicPriceFilter, dynamicSortFilter];
}

const categoryIdentityParams = new Set([
  "categoryId",
  "subcategoryId",
  "productTypeId",
]);

function filtersFromSearchParams(searchParams: Pick<URLSearchParams, "forEach">) {
  const filters: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    if (value && !categoryIdentityParams.has(key)) {
      filters[key] = value;
    }
  });

  return filters;
}

function filtersMatch(
  left: Record<string, string>,
  right: Record<string, string>,
) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value]) => right[key] === value)
  );
}

export default function CategoryListingClient({
  mainSlug,
  groupSlug = "",
  partSlug,
}: CategoryListingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryIdFilter = searchParams.get("categoryId") || "";
  const subcategoryIdFilter = searchParams.get("subcategoryId") || "";
  const productTypeIdFilter = searchParams.get("productTypeId") || "";
  const categoryPart = useMemo(
    () => (groupSlug ? findCategoryPart(mainSlug, groupSlug, partSlug) : null),
    [groupSlug, mainSlug, partSlug],
  );
  const config = useMemo(
    () =>
      getCategoryListingConfig({
        mainSlug,
        groupSlug,
        partSlug,
        mainName: categoryPart?.main.name || titleFromSlug(mainSlug),
        groupName: categoryPart?.group.name || (groupSlug ? titleFromSlug(groupSlug) : ""),
        partName: categoryPart?.part.name || titleFromSlug(partSlug),
      }),
    [categoryPart, groupSlug, mainSlug, partSlug],
  );
  const fallbackSizes = useMemo(
    () => getDefaultSizes(config.sizeGuideType),
    [config.sizeGuideType],
  );
  const sizeGuideLabel = getSizeGuideLabel(config.sizeGuideType);
  const addWishlist = useWishlistStore((state) => state.addItem);
  const removeWishlist = useWishlistStore((state) => state.removeItem);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalProducts, setTotalProducts] = useState(0);
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>(() =>
    filtersFromSearchParams(searchParams),
  );
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>(() =>
    filtersFromSearchParams(searchParams),
  );
  const [desktopFilterOpen, setDesktopFilterOpen] = useState<string | null>(null);
  const [desktopFilterPosition, setDesktopFilterPosition] = useState<{
    left: number;
    minWidth: number;
    top: number;
  } | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [metadataReadyKey, setMetadataReadyKey] = useState("");
  const [dynamicCategoryNode, setDynamicCategoryNode] = useState<PublicCategoryNode | null>(null);
  const [dynamicBreadcrumb, setDynamicBreadcrumb] = useState<string[]>([]);
  const [dynamicShortcuts, setDynamicShortcuts] = useState<CategoryShortcut[]>([]);
  const [dynamicFilters, setDynamicFilters] = useState<CategoryFilter[]>([]);
  const [useMobileBanner, setUseMobileBanner] = useState(false);
  const desktopFilterButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const desktopFilterPanelRef = useRef<HTMLDivElement | null>(null);
  const metadataRequestIdRef = useRef(0);
  const productRequestIdRef = useRef(0);
  const searchParamsKey = searchParams.toString();
  const routeIdentityKey = [
    mainSlug,
    groupSlug,
    partSlug,
    categoryIdFilter,
    subcategoryIdFilter,
    productTypeIdFilter,
  ].join("|");
  const metadataReady = metadataReadyKey === routeIdentityKey;

  const genericDynamicFilters = useMemo(() => [dynamicPriceFilter, dynamicSortFilter], []);
  const listingFilters = dynamicCategoryNode
    ? dynamicFilters.length > 0
      ? dynamicFilters
      : genericDynamicFilters
    : config.filters;
  const selectedChips = getActiveChips(filterDraft, listingFilters);
  const listingDisplayName = dynamicCategoryNode?.name || config.displayName;
  const listingBreadcrumb = dynamicBreadcrumb.length ? dynamicBreadcrumb : config.breadcrumb;
  const listingShortcuts = dynamicCategoryNode ? dynamicShortcuts : config.shortcutButtons;
  const resolvedCategoryId =
    categoryIdFilter ||
    (dynamicCategoryNode?.entityType === "category" ? dynamicCategoryNode.id : "");
  const resolvedSubcategoryId =
    subcategoryIdFilter ||
    (dynamicCategoryNode?.entityType === "subcategory" ? dynamicCategoryNode.id : "");
  const resolvedProductTypeId =
    productTypeIdFilter ||
    (dynamicCategoryNode?.entityType === "productType" ? dynamicCategoryNode.id : "");
  const viewAllHref =
    dynamicCategoryNode?.entityType === "productType" && dynamicCategoryNode.parentId
      ? `/products?productTypeId=${encodeURIComponent(dynamicCategoryNode.id)}`
      : dynamicCategoryNode?.entityType === "subcategory"
        ? `/products?subcategoryId=${encodeURIComponent(dynamicCategoryNode.id)}`
        : dynamicCategoryNode
          ? `/products?category=${encodeURIComponent(dynamicCategoryNode.slug)}`
          : "/products";
  const searchTerm = listingDisplayName;
  const dynamicDesktopBanner = dynamicCategoryNode
    ? getCategoryDesktopBanner(dynamicCategoryNode)
    : "";
  const dynamicMobileBanner = dynamicCategoryNode
    ? getCategoryMobileBanner(dynamicCategoryNode)
    : "";
  const dynamicBanner = useMobileBanner ? dynamicMobileBanner : dynamicDesktopBanner;
  const bannerImage =
    dynamicBanner && dynamicBanner !== categoryPlaceholderImage
      ? dynamicBanner
      : config.bannerImage;
  const bannerAlt =
    dynamicCategoryNode?.altText || `${listingDisplayName} category banner`;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setUseMobileBanner(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++metadataRequestIdRef.current;
    setMetadataReadyKey("");
    setDynamicCategoryNode(null);
    setDynamicBreadcrumb([]);
    setDynamicShortcuts([]);
    setDynamicFilters([]);
    setProducts([]);
    setTotalProducts(0);
    setLoading(true);
    setError("");

    async function loadDynamicCategoryMetadata() {
      try {
        let tree = getCachedPublicCategoryTree();

        if (!tree) {
          const response = await fetch("/api/categories", {
            signal: controller.signal,
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Categories could not be loaded.");
          }
          tree = normalizePublicCategoryTree(data);
          cachePublicCategoryTree(tree);
        }

        if (controller.signal.aborted || requestId !== metadataRequestIdRef.current) {
          return;
        }

        const category = tree.find((node) => node.slug === mainSlug) || null;
        const subcategory = category?.children.find((node) => node.slug === (groupSlug || partSlug)) || null;
        const productType = groupSlug
          ? subcategory?.productTypes.find((node) => node.slug === partSlug) || null
          : null;
        const selectedNode =
          findCategoryNodeByPath(tree, mainSlug, groupSlug || partSlug, groupSlug ? partSlug : "") ||
          productType ||
          subcategory ||
          category ||
          findCategoryNodeByAnySlug(tree, partSlug) ||
          findCategoryNodeByAnySlug(tree, groupSlug) ||
          findCategoryNodeByAnySlug(tree, mainSlug);
        const selectedCategory =
          selectedNode?.entityType === "category"
            ? selectedNode
            : tree.find((node) => node.slug === selectedNode?.categorySlug) || category;
        const selectedSubcategory =
          selectedNode?.entityType === "subcategory"
            ? selectedNode
            : selectedNode?.entityType === "productType"
              ? selectedCategory?.children.find((node) => node.slug === selectedNode.subcategorySlug) || subcategory
              : subcategory;
        setDynamicCategoryNode(selectedNode);
        setDynamicBreadcrumb([selectedCategory?.name, selectedSubcategory?.name, selectedNode?.entityType === "productType" ? selectedNode.name : ""]
          .filter((value): value is string => Boolean(value)));

        const relatedNodes =
          selectedNode?.entityType === "productType" && selectedSubcategory
            ? selectedSubcategory.productTypes
            : selectedNode?.entityType === "subcategory" && selectedNode.productTypes.length
              ? selectedNode.productTypes
              : selectedNode?.entityType === "category" && selectedNode.children.length
                ? selectedNode.children
                : selectedSubcategory?.productTypes.length
                  ? selectedSubcategory.productTypes
                  : selectedCategory?.children || [];
        setDynamicShortcuts(
          relatedNodes.map((node) => ({
            label: node.name,
            slug: node.slug,
            href: getCategoryHref(node),
          })),
        );

        const categoryId = categoryIdFilter || selectedCategory?.id || "";
        const subcategoryId = subcategoryIdFilter || selectedSubcategory?.id || "";
        const productTypeId = productTypeIdFilter || (selectedNode?.entityType === "productType" ? selectedNode.id : "");
        setMetadataReadyKey(routeIdentityKey);

        if (categoryId) {
          const templateParams = new URLSearchParams({ categoryId });
          if (subcategoryId) templateParams.set("subcategoryId", subcategoryId);
          if (productTypeId) templateParams.set("productTypeId", productTypeId);
          const templateResponse = await fetch(`/api/category-templates?${templateParams.toString()}`, {
            signal: controller.signal,
          });
          const templateData = await templateResponse.json();
          if (
            !controller.signal.aborted &&
            requestId === metadataRequestIdRef.current &&
            templateResponse.ok
          ) {
            setDynamicFilters(filtersFromTemplate(templateData.template || null));
          }
        }
      } catch (metadataError) {
        if (
          !controller.signal.aborted &&
          requestId === metadataRequestIdRef.current
        ) {
          setDynamicCategoryNode(null);
          setDynamicBreadcrumb([]);
          setDynamicShortcuts([]);
          setDynamicFilters([]);
          setMetadataReadyKey(routeIdentityKey);
          if (metadataError instanceof Error) {
            setError(metadataError.message);
          }
        }
      }
    }

    loadDynamicCategoryMetadata();

    return () => {
      controller.abort();
    };
  }, [categoryIdFilter, groupSlug, mainSlug, partSlug, productTypeIdFilter, routeIdentityKey, subcategoryIdFilter]);

  useEffect(() => {
    const nextFilters = filtersFromSearchParams(new URLSearchParams(searchParamsKey));
    setFilterDraft((current) =>
      filtersMatch(current, nextFilters) ? current : nextFilters,
    );
    setAppliedFilters((current) =>
      filtersMatch(current, nextFilters) ? current : nextFilters,
    );
  }, [searchParamsKey]);

  useEffect(() => {
    if (!metadataReady) {
      return;
    }

    const controller = new AbortController();
    const requestId = ++productRequestIdRef.current;

    async function loadProducts() {
      const params = new URLSearchParams({
        limit: "24",
        sort: appliedFilters.sort || "popular",
      });

      if (resolvedProductTypeId) {
        params.set("productTypeId", resolvedProductTypeId);
      } else if (resolvedSubcategoryId) {
        params.set("subcategoryId", resolvedSubcategoryId);
      } else if (resolvedCategoryId) {
        params.set("categoryId", resolvedCategoryId);
      } else {
        params.set("search", searchTerm);
      }

      const discount = appliedFilters.discount || appliedFilters.allDiscount;
      if (discount) {
        params.set("offer", "true");
      }

      const priceFilter = dynamicPriceFilter.options.find(
        (option) => option.value === appliedFilters.price,
      );

      if (priceFilter?.minPrice) {
        params.set("minPrice", priceFilter.minPrice);
      }

      if (priceFilter?.maxPrice) {
        params.set("maxPrice", priceFilter.maxPrice);
      }

      Object.entries(appliedFilters)
        .sort(([left], [right]) => left.localeCompare(right))
        .forEach(([key, value]) => {
          if (
            value &&
            !["sort", "price", "discount", "allDiscount"].includes(key)
          ) {
            params.set(key, value);
          }
        });

      const requestUrl = `/api/products?${params.toString()}`;
      const cachedListing = getCachedCategoryListing<Product>(requestUrl);
      if (cachedListing) {
        setProducts(cachedListing.products);
        setTotalProducts(cachedListing.total);
        setLoading(false);
        setError("");
        return;
      }

      setProducts([]);
      setTotalProducts(0);
      setLoading(true);
      setError("");

      try {
        const response = await fetch(requestUrl, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (
          controller.signal.aborted ||
          requestId !== productRequestIdRef.current
        ) {
          return;
        }

        if (!response.ok) {
          setError(data.error || "Products could not be loaded.");
          return;
        }

        const listing = {
          products: (data.products || []) as Product[],
          total: Number(data.total || 0),
        };
        cacheCategoryListing(requestUrl, listing);
        setProducts(listing.products);
        setTotalProducts(listing.total);
      } catch (productError) {
        if (
          !controller.signal.aborted &&
          requestId === productRequestIdRef.current
        ) {
          setError(
            productError instanceof Error
              ? productError.message
              : "Products could not be loaded.",
          );
        }
      } finally {
        if (
          !controller.signal.aborted &&
          requestId === productRequestIdRef.current
        ) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      controller.abort();
    };
  }, [
    appliedFilters,
    metadataReady,
    resolvedCategoryId,
    resolvedProductTypeId,
    resolvedSubcategoryId,
    searchTerm,
  ]);

  useEffect(() => {
    if (!desktopFilterOpen) {
      setDesktopFilterPosition(null);
      return;
    }

    const openKey = desktopFilterOpen;

    function updatePosition() {
      const button = desktopFilterButtonRefs.current[openKey];
      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const panelWidth = 224;
      const margin = 8;
      const left = Math.min(
        Math.max(rect.left, margin),
        window.innerWidth - panelWidth - margin,
      );

      setDesktopFilterPosition({
        left,
        minWidth: Math.max(rect.width, 176),
        top: rect.bottom + 8,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [desktopFilterOpen]);

  useEffect(() => {
    if (!desktopFilterOpen) {
      return;
    }

    const openKey = desktopFilterOpen;

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      const openButton = desktopFilterButtonRefs.current[openKey];

      if (openButton?.contains(target) || desktopFilterPanelRef.current?.contains(target)) {
        return;
      }

      setDesktopFilterOpen(null);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [desktopFilterOpen]);

  function setDraftFilter(key: string, value: string) {
    setFilterDraft((current) => ({
      ...current,
      [key]: current[key] === value ? "" : value,
    }));
  }

  function selectFilterOption(key: string, value: string, compact: boolean) {
    setDraftFilter(key, value);

    if (!compact) {
      setDesktopFilterOpen(null);
    }
  }

  function toggleDesktopFilter(key: string) {
    setDesktopFilterOpen((current) => (current === key ? null : key));
  }

  function applyFilters(nextFilters = filterDraft) {
    const cleanFilters = Object.fromEntries(
      Object.entries(nextFilters).filter(([, value]) => Boolean(value)),
    );
    const params = new URLSearchParams();

    if (resolvedProductTypeId) {
      params.set("productTypeId", resolvedProductTypeId);
    } else if (resolvedSubcategoryId) {
      params.set("subcategoryId", resolvedSubcategoryId);
    } else if (resolvedCategoryId) {
      params.set("categoryId", resolvedCategoryId);
    }

    Object.entries(cleanFilters).forEach(([key, value]) => {
      params.set(key, value);
    });

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setAppliedFilters(cleanFilters);
    setFilterDraft(cleanFilters);
    setDesktopFilterOpen(null);
    setMobileFiltersOpen(false);
  }

  function clearFilters() {
    setFilterDraft({});
    applyFilters({});
  }

  function removeFilter(key: string) {
    const nextFilters = { ...filterDraft };
    delete nextFilters[key];
    setFilterDraft(nextFilters);
  }

  function renderFilterControl(filter: CategoryFilter, compact = false) {
    return (
      <div key={filter.key} className={compact ? "border-b border-stone-200 py-4" : "relative"}>
        {compact ? (
          <p className="text-sm font-black text-[#132238]">{filter.label}</p>
        ) : (
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#7a6426]">
            {filter.label}
          </p>
        )}
        <div className={compact ? "mt-3 grid grid-cols-2 gap-2" : "flex min-w-44 flex-col gap-1 rounded-lg border border-[#e6d6b9] bg-white p-2 shadow-sm"}>
          {filter.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => selectFilterOption(filter.key, option.value, compact)}
              className={`rounded-md px-3 py-2 text-left text-xs font-bold transition ${
                filterDraft[filter.key] === option.value
                  ? "bg-[#132238] text-white"
                  : "bg-[#fbf7ef] text-stone-700 hover:bg-[#efe2c9]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f1e7] pb-20 text-[#17130f]">
      <Navbar />

      <section className="bg-[#132238] text-[#fff8ed]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(520px,1.15fr)] lg:items-center md:py-10">
          <div>
            <Link href="/" className="text-sm font-bold text-[#d5b46b] hover:text-white">
              Back to Home
            </Link>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-[#d5b46b]">
              Product Listing
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-normal md:text-5xl">
              {listingDisplayName}
            </h1>
            <p className="mt-3 text-sm font-semibold text-[#decfb5]">
              {listingBreadcrumb.join(" / ")}
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-[#f0e3ca]">
              Browse {listingDisplayName} products with category-specific filters,
              vendor stock, product details and fresh marketplace listings.
            </p>
          </div>
          <div className="relative min-h-48 overflow-hidden rounded-md border border-[#d5b46b]/30 bg-[#efe2c9] sm:min-h-64 lg:aspect-[16/5] lg:min-h-0">
            <Image
              src={bannerImage}
              alt={bannerAlt}
              fill
              priority
              sizes="(min-width: 1024px) 680px, 100vw"
              className="object-contain"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#132238]/45 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 rounded-full bg-white/95 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#132238]">
              {sizeGuideLabel}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e5d6bd] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#132238]">Select Your Category</h2>
              <p className="text-sm text-stone-500">Jump to related category shelves.</p>
            </div>
            <Link
              href={viewAllHref}
              className="w-fit rounded-full border border-[#d5b46b] px-4 py-2 text-xs font-black uppercase text-[#132238]"
            >
              View All {listingDisplayName}
            </Link>
          </div>
          {listingShortcuts.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {listingShortcuts.map((shortcut) => (
              <Link
                key={shortcut.slug}
                href={shortcut.href}
                className="shrink-0 rounded-full border border-[#e2cfaa] bg-[#fbf7ef] px-4 py-2 text-sm font-bold text-[#132238] hover:border-[#132238] hover:bg-white"
              >
                {shortcut.label}
              </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-5">
        <div className="mb-4 rounded-md border border-[#e4d5bc] bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7a6426]">
                Filters
              </p>
              <p className="text-sm text-stone-500">
                {loading ? "Loading products..." : `${products.length} of ${totalProducts || products.length} products shown`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="rounded-full bg-[#132238] px-4 py-2 text-sm font-black text-white lg:hidden"
            >
              Filter & Sort{selectedChips.length ? ` (${selectedChips.length})` : ""}
            </button>
          </div>

          <div className="mt-4 hidden gap-3 overflow-x-auto pb-2 lg:flex">
            {listingFilters.map((filter) => {
              const selectedValue = filterDraft[filter.key];
              const selectedLabel = filter.options.find(
                (option) => option.value === selectedValue,
              )?.label;

              return (
                <div key={filter.key} className="relative shrink-0">
                  <button
                    type="button"
                    ref={(element) => {
                      desktopFilterButtonRefs.current[filter.key] = element;
                    }}
                    onClick={() => toggleDesktopFilter(filter.key)}
                    className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.08em] ${
                      selectedLabel
                        ? "border-[#132238] bg-[#132238] text-white"
                        : "border-[#e2cfaa] bg-[#fbf7ef] text-[#132238]"
                    }`}
                    aria-expanded={desktopFilterOpen === filter.key}
                  >
                    {selectedLabel ? `${filter.label}: ${selectedLabel}` : filter.label}
                  </button>
                </div>
              );
            })}
          </div>

          {desktopFilterOpen && desktopFilterPosition && (
            <div
              ref={desktopFilterPanelRef}
              className="fixed z-50"
              style={{
                left: desktopFilterPosition.left,
                minWidth: desktopFilterPosition.minWidth,
                top: desktopFilterPosition.top,
              }}
            >
              {renderFilterControl(
                listingFilters.find((filter) => filter.key === desktopFilterOpen) ||
                  listingFilters[0],
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {selectedChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => removeFilter(chip.key)}
                className="rounded-full bg-[#132238] px-3 py-1.5 text-xs font-bold text-white"
              >
                {chip.label} x
              </button>
            ))}
            {selectedChips.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-[#d5b46b] px-3 py-1.5 text-xs font-black text-[#132238]"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={() => applyFilters()}
              className="hidden rounded-full bg-[#d5b46b] px-4 py-1.5 text-xs font-black text-[#132238] lg:inline-flex"
            >
              Apply
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-md bg-white shadow-sm">
                <div className="aspect-[3/4] animate-pulse bg-stone-200" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-stone-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-stone-200" />
                  <div className="h-4 w-20 animate-pulse rounded bg-stone-200" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-md bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-black">No products found yet</h2>
            <p className="mt-2 text-stone-500">
              Vendors can add products for {listingDisplayName} from the vendor dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product, index) => {
              const stock = getStockSignal(product);
              const sizes = getProductSizes(product, fallbackSizes);
              const wishlistActive = isInWishlist(product.id);
              const categoryName = product.subcategory?.name || product.category?.name || listingDisplayName;

              return (
                <article
                  key={product.id}
                  className="group overflow-hidden rounded-md border border-[#eadcc2] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#e8dccb]">
                    <Link href={getProductHref(product)}>
                      <Image
                        src={product.images?.[0] || fallbackImage}
                        alt={product.name}
                        fill
                        priority={index < 4}
                        sizes="(min-width: 1280px) 220px, (min-width: 768px) 25vw, 50vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    </Link>
                    <button
                      type="button"
                      aria-label={wishlistActive ? "Remove from wishlist" : "Add to wishlist"}
                      onClick={() => {
                        if (wishlistActive) {
                          removeWishlist(product.id);
                        } else {
                          addWishlist({
                            id: product.id,
                            name: product.name,
                            category: categoryName,
                            price: product.price,
                            mrp: product.mrp || undefined,
                            discountPercent: product.discountPercent || undefined,
                            image: product.images?.[0] || fallbackImage,
                          });
                        }
                      }}
                      className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-lg font-black text-[#132238] shadow"
                    >
                      {wishlistActive ? "\u2665" : "\u2661"}
                    </button>
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-black ${stock.className}`}>
                      {stock.label}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-[#9c7a34]">
                      {product.vendor?.storeName || "Marketplace Brand"}
                    </p>
                    <Link href={getProductHref(product)}>
                      <h3 className="mt-1 line-clamp-2 min-h-9 text-sm font-black leading-5 text-[#17130f] hover:text-[#6b145d]">
                        {product.name}
                      </h3>
                    </Link>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <span className="text-base font-black text-[#315c48]">
                        Rs. {Number(product.price || 0).toLocaleString("en-IN")}
                      </span>
                      {product.mrp && product.mrp > product.price && (
                        <>
                          <span className="text-xs text-stone-500 line-through">
                            Rs. {Number(product.mrp).toLocaleString("en-IN")}
                          </span>
                          <span className="text-xs font-black text-green-700">
                            {product.discountPercent || 0}% off
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="rounded bg-green-600 px-1.5 py-0.5 font-black text-white">
                        4.{metric(product.id, 1, 8)}
                      </span>
                      <span className="text-stone-500">{metric(product.id, 24, 680)} ratings</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {sizes.map((size) => (
                        <span
                          key={size}
                          className="rounded-full border border-[#e2cfaa] px-2 py-1 text-[10px] font-bold text-stone-700"
                        >
                          {size}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-bold text-[#6b145d]">
                      {sizeGuideLabel}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden">
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-200 bg-white pb-3">
              <div>
                <h2 className="text-lg font-black text-[#132238]">Filter & Sort</h2>
                <p className="text-xs text-stone-500">{listingDisplayName}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-black"
              >
                Close
              </button>
            </div>
            <div>{listingFilters.map((filter) => renderFilterControl(filter, true))}</div>
            <div className="sticky bottom-0 mt-4 grid grid-cols-2 gap-3 border-t border-stone-200 bg-white pt-3">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-[#132238] px-4 py-3 text-sm font-black text-[#132238]"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => applyFilters()}
                className="rounded-full bg-[#132238] px-4 py-3 text-sm font-black text-white"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileNavbar />
    </main>
  );
}
