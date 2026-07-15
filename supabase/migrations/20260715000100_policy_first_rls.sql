-- Zylo-Buylo policy-first RLS hardening.
-- Do not run this on production until the staging checklist in
-- SUPABASE_RLS_POLICY_AUDIT.md has passed.

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
    '"Category"',
    '"Subcategory"',
    '"ProductType"',
    '"HomepageContent"',
    '"CategoryUploadTemplate"',
    '"CategoryAuditLog"',
    '"ProductVariant"',
    '"VendorWallet"',
    '"VendorBankAccount"',
    '"VendorPayout"',
    '"VendorPayoutSettlement"',
    '"VendorLedger"',
    '"CommissionRule"',
    '"SettlementReport"',
    '"RefundAdjustment"',
    '"Inventory"',
    '"StockMovement"',
    '"StockReservation"',
    '"AdminBusinessProfile"',
    '"ReturnRefundRequest"',
    'size_charts',
    'size_chart_items',
    'order_verification',
    'dispatch_images',
    'delivery_otp',
    'open_box_verification',
    'return_requests',
    'return_evidence',
    'risk_assessment',
    'vendor_protection_logs',
    'vendor_mobile_otp'
  ]) as required(table_name)
  where to_regclass('public.' || table_name) is null;

  if missing_tables is not null then
    raise exception 'Policy-first RLS migration aborted. Required audited tables are missing: %', missing_tables;
  end if;
end $$;

do $$
declare
  missing_columns text[];
begin
  select array_agg(table_name || '.' || column_name order by table_name, column_name)
  into missing_columns
  from (values
    ('Category', 'id'),
    ('Category', 'status'),
    ('Category', 'archivedAt'),
    ('Subcategory', 'id'),
    ('Subcategory', 'categoryId'),
    ('Subcategory', 'status'),
    ('Subcategory', 'archivedAt'),
    ('ProductType', 'id'),
    ('ProductType', 'subcategoryId'),
    ('ProductType', 'status'),
    ('ProductType', 'archivedAt'),
    ('HomepageContent', 'id'),
    ('ProductVariant', 'id'),
    ('ProductVariant', 'productId'),
    ('ProductVariant', 'sizeLabel'),
    ('ProductVariant', 'numericSize'),
    ('ProductVariant', 'color'),
    ('ProductVariant', 'sku'),
    ('ProductVariant', 'price'),
    ('ProductVariant', 'mrp'),
    ('ProductVariant', 'imageUrl'),
    ('ProductVariant', 'status'),
    ('Product', 'id'),
    ('Product', 'priceApproved'),
    ('Product', 'categoryId'),
    ('Product', 'subcategoryId'),
    ('size_charts', 'id'),
    ('size_charts', 'isActive'),
    ('size_chart_items', 'sizeChartId')
  ) as required(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = required.table_name
      and c.column_name = required.column_name
  );

  if missing_columns is not null then
    raise exception 'Policy-first RLS migration aborted. Required policy columns are missing: %', missing_columns;
  end if;
end $$;

create or replace function private.zylo_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'ADMIN', false)
$$;

create or replace function private.zylo_active_category(category_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."Category" c
    where c."id" = category_id
      and c."status" = 'ACTIVE'
      and c."archivedAt" is null
  )
$$;

create or replace function private.zylo_active_subcategory(subcategory_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."Subcategory" s
    where s."id" = subcategory_id
      and s."status" = 'ACTIVE'
      and s."archivedAt" is null
      and private.zylo_active_category(s."categoryId")
  )
$$;

create or replace function private.zylo_approved_catalog_product(product_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."Product" p
    where p."id" = product_id
      and p."priceApproved" = true
      and (p."categoryId" is null or private.zylo_active_category(p."categoryId"))
      and (p."subcategoryId" is null or private.zylo_active_subcategory(p."subcategoryId"))
  )
$$;

revoke all on function private.zylo_is_admin() from public, anon, authenticated;
revoke all on function private.zylo_active_category(text) from public, anon, authenticated;
revoke all on function private.zylo_active_subcategory(text) from public, anon, authenticated;
revoke all on function private.zylo_approved_catalog_product(text) from public, anon, authenticated;
grant execute on function private.zylo_is_admin() to authenticated;
grant execute on function private.zylo_active_category(text) to anon, authenticated;
grant execute on function private.zylo_active_subcategory(text) to anon, authenticated;
grant execute on function private.zylo_approved_catalog_product(text) to anon, authenticated;

create index if not exists "Category_status_archivedAt_idx" on public."Category" ("status", "archivedAt");
create index if not exists "Subcategory_category_status_archivedAt_idx" on public."Subcategory" ("categoryId", "status", "archivedAt");
create index if not exists "ProductType_subcategory_status_archivedAt_idx" on public."ProductType" ("subcategoryId", "status", "archivedAt");
create index if not exists "Product_catalog_visibility_idx" on public."Product" ("priceApproved", "categoryId", "subcategoryId");
create index if not exists "ProductVariant_product_status_idx" on public."ProductVariant" ("productId", "status");
create index if not exists "size_charts_active_idx" on public.size_charts ("isActive");
create index if not exists "size_chart_items_sizeChartId_idx" on public.size_chart_items ("sizeChartId");
create index if not exists "return_requests_userId_idx" on public.return_requests ("userId");
create index if not exists "return_evidence_returnRequestId_idx" on public.return_evidence ("returnRequestId");
create index if not exists "dispatch_images_vendorId_idx" on public.dispatch_images ("vendorId");
create index if not exists "vendor_protection_logs_vendorId_idx" on public.vendor_protection_logs ("vendorId");

drop policy if exists "category_select_public_active" on public."Category";
drop policy if exists "category_insert_admin" on public."Category";
drop policy if exists "category_update_admin" on public."Category";
drop policy if exists "category_delete_admin" on public."Category";
create policy "category_select_public_active" on public."Category"
  for select to anon, authenticated
  using ("status" = 'ACTIVE' and "archivedAt" is null);
create policy "category_insert_admin" on public."Category"
  for insert to authenticated
  with check (private.zylo_is_admin());
create policy "category_update_admin" on public."Category"
  for update to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());
create policy "category_delete_admin" on public."Category"
  for delete to authenticated
  using (private.zylo_is_admin());
alter table public."Category" enable row level security;

drop policy if exists "subcategory_select_public_active" on public."Subcategory";
drop policy if exists "subcategory_insert_admin" on public."Subcategory";
drop policy if exists "subcategory_update_admin" on public."Subcategory";
drop policy if exists "subcategory_delete_admin" on public."Subcategory";
create policy "subcategory_select_public_active" on public."Subcategory"
  for select to anon, authenticated
  using ("status" = 'ACTIVE' and "archivedAt" is null and private.zylo_active_category("categoryId"));
create policy "subcategory_insert_admin" on public."Subcategory"
  for insert to authenticated
  with check (private.zylo_is_admin());
create policy "subcategory_update_admin" on public."Subcategory"
  for update to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());
create policy "subcategory_delete_admin" on public."Subcategory"
  for delete to authenticated
  using (private.zylo_is_admin());
alter table public."Subcategory" enable row level security;

drop policy if exists "product_type_select_public_active" on public."ProductType";
drop policy if exists "product_type_insert_admin" on public."ProductType";
drop policy if exists "product_type_update_admin" on public."ProductType";
drop policy if exists "product_type_delete_admin" on public."ProductType";
create policy "product_type_select_public_active" on public."ProductType"
  for select to anon, authenticated
  using ("status" = 'ACTIVE' and "archivedAt" is null and private.zylo_active_subcategory("subcategoryId"));
create policy "product_type_insert_admin" on public."ProductType"
  for insert to authenticated
  with check (private.zylo_is_admin());
create policy "product_type_update_admin" on public."ProductType"
  for update to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());
create policy "product_type_delete_admin" on public."ProductType"
  for delete to authenticated
  using (private.zylo_is_admin());
alter table public."ProductType" enable row level security;

drop policy if exists "homepage_content_select_public" on public."HomepageContent";
drop policy if exists "homepage_content_insert_admin" on public."HomepageContent";
drop policy if exists "homepage_content_update_admin" on public."HomepageContent";
drop policy if exists "homepage_content_delete_admin" on public."HomepageContent";
create policy "homepage_content_select_public" on public."HomepageContent"
  for select to anon, authenticated
  using ("id" = 'main');
create policy "homepage_content_insert_admin" on public."HomepageContent"
  for insert to authenticated
  with check (private.zylo_is_admin());
create policy "homepage_content_update_admin" on public."HomepageContent"
  for update to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());
create policy "homepage_content_delete_admin" on public."HomepageContent"
  for delete to authenticated
  using (private.zylo_is_admin());
alter table public."HomepageContent" enable row level security;

drop policy if exists "category_upload_template_select_admin" on public."CategoryUploadTemplate";
drop policy if exists "category_upload_template_insert_admin" on public."CategoryUploadTemplate";
drop policy if exists "category_upload_template_update_admin" on public."CategoryUploadTemplate";
drop policy if exists "category_upload_template_delete_admin" on public."CategoryUploadTemplate";
create policy "category_upload_template_select_admin" on public."CategoryUploadTemplate"
  for select to authenticated
  using (private.zylo_is_admin());
create policy "category_upload_template_insert_admin" on public."CategoryUploadTemplate"
  for insert to authenticated
  with check (private.zylo_is_admin());
create policy "category_upload_template_update_admin" on public."CategoryUploadTemplate"
  for update to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());
create policy "category_upload_template_delete_admin" on public."CategoryUploadTemplate"
  for delete to authenticated
  using (private.zylo_is_admin());
alter table public."CategoryUploadTemplate" enable row level security;

drop policy if exists "category_audit_log_select_admin" on public."CategoryAuditLog";
drop policy if exists "category_audit_log_insert_admin" on public."CategoryAuditLog";
create policy "category_audit_log_select_admin" on public."CategoryAuditLog"
  for select to authenticated
  using (private.zylo_is_admin());
create policy "category_audit_log_insert_admin" on public."CategoryAuditLog"
  for insert to authenticated
  with check (private.zylo_is_admin());
alter table public."CategoryAuditLog" enable row level security;

revoke all on table public."ProductVariant" from public, anon, authenticated;
grant select (
  "id",
  "productId",
  "sizeLabel",
  "numericSize",
  "color",
  "sku",
  "price",
  "mrp",
  "imageUrl",
  "status"
) on public."ProductVariant" to anon, authenticated;
drop policy if exists "product_variant_select_public_approved" on public."ProductVariant";
drop policy if exists "product_variant_select_admin" on public."ProductVariant";
drop policy if exists "product_variant_insert_admin" on public."ProductVariant";
drop policy if exists "product_variant_update_admin" on public."ProductVariant";
drop policy if exists "product_variant_delete_admin" on public."ProductVariant";
create policy "product_variant_select_public_approved" on public."ProductVariant"
  for select to anon, authenticated
  using ("status" = 'IN_STOCK' and private.zylo_approved_catalog_product("productId"));
create policy "product_variant_select_admin" on public."ProductVariant"
  for select to authenticated
  using (private.zylo_is_admin());
create policy "product_variant_insert_admin" on public."ProductVariant"
  for insert to authenticated
  with check (private.zylo_is_admin());
create policy "product_variant_update_admin" on public."ProductVariant"
  for update to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());
create policy "product_variant_delete_admin" on public."ProductVariant"
  for delete to authenticated
  using (private.zylo_is_admin());
alter table public."ProductVariant" enable row level security;

create or replace view public.public_product_variants
with (security_invoker = true) as
select
  pv."id",
  pv."productId",
  pv."sizeLabel",
  pv."numericSize",
  pv."color",
  pv."sku",
  pv."price",
  pv."mrp",
  pv."imageUrl",
  pv."status"
from public."ProductVariant" pv
where pv."status" = 'IN_STOCK'
  and private.zylo_approved_catalog_product(pv."productId");
revoke all on public.public_product_variants from public, anon, authenticated;
grant select on public.public_product_variants to anon, authenticated;

drop policy if exists "size_charts_select_public_active" on public.size_charts;
drop policy if exists "size_charts_insert_admin" on public.size_charts;
drop policy if exists "size_charts_update_admin" on public.size_charts;
drop policy if exists "size_charts_delete_admin" on public.size_charts;
create policy "size_charts_select_public_active" on public.size_charts
  for select to anon, authenticated
  using ("isActive" = true);
create policy "size_charts_insert_admin" on public.size_charts
  for insert to authenticated
  with check (private.zylo_is_admin());
create policy "size_charts_update_admin" on public.size_charts
  for update to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());
create policy "size_charts_delete_admin" on public.size_charts
  for delete to authenticated
  using (private.zylo_is_admin());
alter table public.size_charts enable row level security;

drop policy if exists "size_chart_items_select_public_active_parent" on public.size_chart_items;
drop policy if exists "size_chart_items_insert_admin" on public.size_chart_items;
drop policy if exists "size_chart_items_update_admin" on public.size_chart_items;
drop policy if exists "size_chart_items_delete_admin" on public.size_chart_items;
create policy "size_chart_items_select_public_active_parent" on public.size_chart_items
  for select to anon, authenticated
  using (exists (
    select 1
    from public.size_charts sc
    where sc."id" = "sizeChartId"
      and sc."isActive" = true
  ));
create policy "size_chart_items_insert_admin" on public.size_chart_items
  for insert to authenticated
  with check (private.zylo_is_admin());
create policy "size_chart_items_update_admin" on public.size_chart_items
  for update to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());
create policy "size_chart_items_delete_admin" on public.size_chart_items
  for delete to authenticated
  using (private.zylo_is_admin());
alter table public.size_chart_items enable row level security;

-- Server/admin-only tables. The app currently uses trusted server routes for
-- customer/vendor workflows, so direct customer/vendor ownership policies are
-- intentionally not created until Supabase auth.uid() is proven to map to app User.id.
do $$
declare
  table_name text;
  policy_prefix text;
begin
  foreach table_name in array array[
    '"VendorWallet"',
    '"VendorBankAccount"',
    '"VendorPayout"',
    '"VendorPayoutSettlement"',
    '"VendorLedger"',
    '"CommissionRule"',
    '"SettlementReport"',
    '"RefundAdjustment"',
    '"Inventory"',
    '"StockMovement"',
    '"StockReservation"',
    '"AdminBusinessProfile"',
    '"ReturnRefundRequest"',
    'order_verification',
    'dispatch_images',
    'open_box_verification',
    'return_requests',
    'return_evidence',
    'risk_assessment',
    'vendor_protection_logs'
  ] loop
    policy_prefix := replace(replace(replace(lower(table_name), '"', ''), '_', ''), '.', '');
    execute format('drop policy if exists %I on public.%s', policy_prefix || '_select_admin', table_name);
    execute format('drop policy if exists %I on public.%s', policy_prefix || '_insert_admin', table_name);
    execute format('drop policy if exists %I on public.%s', policy_prefix || '_update_admin', table_name);
    execute format('drop policy if exists %I on public.%s', policy_prefix || '_delete_admin', table_name);
    execute format('create policy %I on public.%s for select to authenticated using (private.zylo_is_admin())', policy_prefix || '_select_admin', table_name);
    execute format('create policy %I on public.%s for insert to authenticated with check (private.zylo_is_admin())', policy_prefix || '_insert_admin', table_name);
    execute format('create policy %I on public.%s for update to authenticated using (private.zylo_is_admin()) with check (private.zylo_is_admin())', policy_prefix || '_update_admin', table_name);
    execute format('create policy %I on public.%s for delete to authenticated using (private.zylo_is_admin())', policy_prefix || '_delete_admin', table_name);
    execute format('alter table public.%s enable row level security', table_name);
  end loop;
end $$;

-- OTP tables: no direct anon/authenticated SELECT, INSERT, UPDATE or DELETE policy.
-- Generation and verification must stay inside trusted server routes.
revoke all on table public.delivery_otp from public, anon, authenticated;
drop policy if exists "delivery_otp_select_admin" on public.delivery_otp;
drop policy if exists "delivery_otp_insert_admin" on public.delivery_otp;
drop policy if exists "delivery_otp_update_admin" on public.delivery_otp;
drop policy if exists "delivery_otp_delete_admin" on public.delivery_otp;
alter table public.delivery_otp enable row level security;

revoke all on table public.vendor_mobile_otp from public, anon, authenticated;
drop policy if exists "vendor_mobile_otp_select_admin" on public.vendor_mobile_otp;
drop policy if exists "vendor_mobile_otp_insert_admin" on public.vendor_mobile_otp;
drop policy if exists "vendor_mobile_otp_update_admin" on public.vendor_mobile_otp;
drop policy if exists "vendor_mobile_otp_delete_admin" on public.vendor_mobile_otp;
alter table public.vendor_mobile_otp enable row level security;

commit;
