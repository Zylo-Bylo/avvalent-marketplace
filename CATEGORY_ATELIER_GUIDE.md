# Category Atelier Guide

## Page structure

The admin category system lives at `/admin/categories`.

The active page delegates to `components/admin/CategoryAtelierManager.tsx`. The previous page code remains in place as a legacy component, but the route now renders the upgraded manager.

Main sections:

- Create hierarchy: add Main Category, Subcategory, and Product Type / Leaf Category.
- Search and filters: search names/slugs and filter by active/inactive/archive and template health.
- Template status dashboard: shows specification, variant, size guide, filter, return-rule, and overall completion status per category.
- Live category tree: supports select, edit, rename, move, merge, duplicate, activate/deactivate, archive, confirmed delete, and drag-and-drop reorder.
- Metadata editor: Category ID, slug, parent relationship, status, sort order, homepage icon, category image, desktop banner, mobile banner, and alt text.
- Template builder: specification fields, variant rows, size-guide rows, category filters, business rules, draft/publish/reset/restore controls, last saved timestamp, and saved-by admin.
- CSV tools: category master CSV download, valid IDs/slugs/names, mapping preview, missing category detection, spelling suggestions, and case-insensitive trimmed matching.
- Duplicate detection and merge: shows duplicate sibling names and lets admins merge one main category into another.
- Preview modes: vendor upload form, customer product page, customer filter view, and mobile preview.
- Audit log: recent admin actions with admin user, action, entity, and date/time.

## Database models

Existing `Category` and `Subcategory` rows are preserved. The migration only adds columns and new tables.

Added to `Category`:

- `status`
- `sortOrder`
- `homepageIcon`
- `categoryImage`
- `desktopBanner`
- `mobileBanner`
- `altText`
- `archivedAt`

Added to `Subcategory`:

- `status`
- `sortOrder`
- `homepageIcon`
- `categoryImage`
- `desktopBanner`
- `mobileBanner`
- `altText`
- `archivedAt`

Added models:

- `ProductType`: leaf category under a subcategory.
- `CategoryAuditLog`: admin activity record.

Added to `Product`:

- nullable `productTypeId`

Existing `CategoryUploadTemplate` data is preserved. It is still managed through the existing raw-SQL helper in `lib/category-upload-templates.ts`, with richer JSON stored inside `specTemplate` and `variantConfig`.

## How to create a category

1. Open `/admin/categories`.
2. Use Create hierarchy.
3. Add a Main Category.
4. Select that main category and add a Subcategory.
5. Select that subcategory and add Product Type / Leaf Category rows.
6. Select any node in the live tree to edit slug, status, sort order, icons, images, banners, or alt text.

## How to create specifications

1. Select the template category and optional subcategory.
2. In Specification Field Builder, add fields.
3. Configure name, label, field type, required status, dropdown values, unit, placeholder, customer visibility, filterable/searchable flags, vendor editable, admin only, and display order.
4. Use Save Draft while working or Publish when ready.

## How to create variants

1. In Variant Builder, add variant rows.
2. Fill size label, numeric size, color, SKU, barcode, stock, low-stock threshold, price, MRP, weight, variant image, active status, and default variant.
3. Save Draft or Publish the template.

## How to create a size guide

1. In Size Guide Builder, add a row.
2. Choose the guide type, such as Men's shirts, Trousers, Women's kurtis, Kids clothing, or footwear.
3. Fill India, UK, US, EU, chest, waist, hip, length, foot length, and age group columns as applicable.
4. Save Draft or Publish.

## How CSV mapping works

CSV preview accepts headers such as:

```csv
categoryName,subcategoryName,productTypeName
Men Fashion,Shirts,Formal Shirt
```

Matching rules:

- Category ID, slug, and name are valid identifiers.
- Names are trimmed before matching.
- Matching is case-insensitive.
- Subcategories are matched under the resolved category.
- Product types are matched under the resolved subcategory.
- Missing categories, missing subcategories, and missing product types are flagged before import.
- Near category spellings receive a suggestion using edit-distance matching.

The master CSV download lists valid category names, slugs, IDs, parent IDs, status, and sort order for all three hierarchy levels.
