import { describe, expect, it } from "vitest";
import {
  categoryPlaceholderImage,
  findCategoryNodeByAnySlug,
  getCategoryDesktopBanner,
  getCategoryHref,
  getCategorySmallImage,
  normalizeCategoryImageUrl,
  normalizePublicCategoryTree,
} from "@/lib/public-category-navigation";

describe("public category navigation", () => {
  it("normalizes the active three-level hierarchy in sort order", () => {
    const categories = normalizePublicCategoryTree({
      categories: [
        {
          id: "cat-men",
          name: "Men's",
          slug: "mens",
          sortOrder: 2,
          subcategories: [
            {
              id: "sub-shirts",
              name: "Shirts",
              slug: "shirts",
              categoryId: "cat-men",
              sortOrder: 2,
              productTypes: [
                {
                  id: "pt-casual-shirts",
                  name: "Casual Shirts",
                  slug: "casual-shirts",
                  subcategoryId: "sub-shirts",
                  sortOrder: 1,
                },
              ],
            },
            {
              id: "sub-hidden",
              name: "Hidden",
              slug: "hidden",
              categoryId: "cat-men",
              status: "INACTIVE",
              sortOrder: 1,
            },
          ],
        },
        {
          id: "cat-women",
          name: "Women's",
          slug: "womens",
          sortOrder: 1,
          archivedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({
      id: "cat-men",
      entityType: "category",
      parentId: null,
      slug: "mens",
    });
    expect(categories[0].children).toHaveLength(1);
    expect(categories[0].children[0]).toMatchObject({
      id: "sub-shirts",
      entityType: "subcategory",
      parentId: "cat-men",
    });
    expect(categories[0].children[0].productTypes[0]).toMatchObject({
      id: "pt-casual-shirts",
      entityType: "productType",
      parentId: "sub-shirts",
    });
  });

  it("uses permanent image URLs and ignores browser-only temporary URLs", () => {
    const [category] = normalizePublicCategoryTree([
      {
        id: "cat-home",
        name: "Home",
        slug: "home",
        homepageIconUrl: "blob:https://zylo-buylo.local/icon",
        categoryImageUrl: "https://cdn.example.com/home.webp",
      },
    ]);

    expect(getCategorySmallImage(category)).toBe("https://cdn.example.com/home.webp");

    const [fallbackCategory] = normalizePublicCategoryTree([
      {
        id: "cat-temp",
        name: "Temporary",
        slug: "temporary",
        homepageIcon: "data:image/png;base64,abc",
        categoryImage: "blob:https://zylo-buylo.local/category",
      },
    ]);

    expect(getCategorySmallImage(fallbackCategory)).toBe(categoryPlaceholderImage);
  });

  it("normalizes unsupported external placeholder category media to the local fallback", () => {
    expect(normalizeCategoryImageUrl("https://placehold.co/1600x500/png?text=Banner")).toBe(
      categoryPlaceholderImage,
    );
    expect(normalizeCategoryImageUrl("https://via.placeholder.com/800x800")).toBe(
      categoryPlaceholderImage,
    );
    expect(normalizeCategoryImageUrl("https://placeholder.com/800x800")).toBe(
      categoryPlaceholderImage,
    );
  });

  it("preserves supported category media URLs", () => {
    expect(
      normalizeCategoryImageUrl(
        "https://demo.supabase.co/storage/v1/object/public/categories/kurtis.webp",
      ),
    ).toBe("https://demo.supabase.co/storage/v1/object/public/categories/kurtis.webp");
    expect(normalizeCategoryImageUrl("/category-banner.webp")).toBe(
      "/category-banner.webp",
    );
  });

  it("falls back from an invalid desktop banner to a valid category image", () => {
    const [category] = normalizePublicCategoryTree([
      {
        id: "cat-kurtis",
        name: "Kurtis",
        slug: "kurtis",
        desktopBanner: "https://placehold.co/1600x500/png?text=Broken",
        categoryImage: "https://demo.supabase.co/storage/v1/object/public/categories/kurtis.webp",
      },
    ]);

    expect(getCategoryDesktopBanner(category)).toBe(
      "https://demo.supabase.co/storage/v1/object/public/categories/kurtis.webp",
    );
  });

  it("routes main, subcategory, and product type nodes to listing filters", () => {
    const [category] = normalizePublicCategoryTree([
      {
        id: "cat-men",
        name: "Men's",
        slug: "mens",
        subcategories: [
          {
            id: "sub-shirts",
            name: "Shirts",
            slug: "shirts",
            productTypes: [
              {
                id: "pt-casual-shirts",
                name: "Casual Shirts",
                slug: "casual-shirts",
              },
            ],
          },
        ],
      },
    ]);

    const subcategory = category.children[0];
    const productType = subcategory.productTypes[0];

    expect(getCategoryHref(category)).toBe("/category/mens/shirts?subcategoryId=sub-shirts");
    expect(getCategoryHref(subcategory)).toBe("/category/mens/shirts?subcategoryId=sub-shirts");
    expect(getCategoryHref(productType)).toBe(
      "/category/mens/shirts/casual-shirts?productTypeId=pt-casual-shirts",
    );
  });

  it("finds dynamic records by slug when old category page paths are used", () => {
    const categories = normalizePublicCategoryTree([
      {
        id: "cat-kurtis",
        name: "Kurtis",
        slug: "kurtis",
        desktopBanner: "https://cdn.example.com/kurtis-banner.webp",
      },
    ]);

    expect(findCategoryNodeByAnySlug(categories, "kurtis")).toMatchObject({
      id: "cat-kurtis",
      desktopBannerUrl: "https://cdn.example.com/kurtis-banner.webp",
    });
  });
});
