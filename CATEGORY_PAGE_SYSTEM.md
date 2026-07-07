# Category Page System

## Overview

Fashion category listing pages use a reusable config-driven system for deep category routes.

Supported route shapes:

- `/category/[main]/[sub]/[part]`
- `/category/[main]/[sub]`

Examples:

- `/category/men/topwear/t-shirts`
- `/category/men/topwear/casual-shirts`
- `/category/women/ethnic-wear/kurtis`
- `/category/women/ethnic-wear/sarees`
- `/category/kids/clothing`
- `/category/footwear/men-shoes`
- `/category/footwear/women-sandals`

The route renders:

- Professional category banner
- Back to Home link
- Product Listing label
- Current category name
- Breadcrumb
- Category banner image
- Select Your Category shortcut buttons
- Desktop horizontal dropdown filters
- Mobile Filter & Sort drawer
- Selected filter chips
- Clear All and Apply buttons
- Product grid with wishlist, brand, price, MRP, discount, rating, sizes and stock status

## Main Files

- Config: `lib/categoryFilters.ts`
- Shared UI: `components/category/CategoryListingClient.tsx`
- Three-level route: `app/category/[main]/[sub]/[part]/page.tsx`
- Two-level route: `app/category/[main]/[sub]/page.tsx`
- Product data API: `app/api/products/route.ts`

## Filter Configuration

Filters are configured in `lib/categoryFilters.ts`.

The system chooses filter groups by category context:

- Clothing: discount, category, brand/subbrand, occasion, size, price, color, fit, sleeves, pattern, neck, cuffs, front opening, fabric, country, sort
- Footwear: discount, category, brand, size, price, color, type, occasion, sole material, closure, heel type, country, sort
- Kids: age group, size, gender, category, brand, price, color, fabric, occasion, pattern, sort

## Adding A New Category

1. Add or adjust detection in `getCategoryListingConfig`.
2. Choose shortcut labels for the category family.
3. Pick the filter list: clothing, footwear or kids.
4. Set a relevant banner image in `getBannerImage`.
5. Set the right size guide type in `getSizeGuideType`.

For a category-specific route, the page can still work without admin database setup because the display name and breadcrumb are derived from route slugs when the category tree has no exact match.

## Adding A Size Guide

Size guide labels are controlled by `SizeGuideType` in `lib/categoryFilters.ts`.

Current supported types:

- `mens-shirt`
- `mens-tshirt`
- `jeans-trouser`
- `kurti`
- `saree`
- `shoes`
- `kids`
- `fashion`

Listing cards show the configured size guide label. Product detail pages already include a size guide section based on product/category text and vendor size fields.

## Changing Banner Image

Update `getBannerImage` in `lib/categoryFilters.ts`.

Use images from `public/`, for example:

- `/products/t-shirt.jpg`
- `/products/Women kurti.jpg`
- `/products/lengha.jpg`
- `/products/Mens shoes.jpg`
- `/products/kids wear.jpg`
- `/hero-banner.png`

## Query Params

Filter state is written to the current category URL after Apply.

Examples:

- `/category/men/topwear/t-shirts?size=m&color=blue&sort=popular`
- `/category/footwear/men-shoes?size=uk-8&price=under-999&sort=price-asc`

Compatibility route:

- Old fashion links such as `/products?category=formal-shirts` redirect to `/category/men/topwear/formal-shirts`.
- Shortcut buttons use category routes when a known fashion route exists.

The product API currently applies these filters directly:

- `sort`
- `brand`
- `price` mapped to `minPrice` and `maxPrice`
- `discount` or `allDiscount` mapped to `offer=true`

Other filter params are preserved in the URL and chips for the storefront UI. They are ready for future database-backed product attributes.

## Future Admin Control

Admin UI is not wired for these listing-page settings yet. Future admin management should store:

- Category banner image
- Shortcut category buttons
- Filter visibility
- Category order
- Featured category images

Until then, `lib/categoryFilters.ts` is the controlled source for this system.
