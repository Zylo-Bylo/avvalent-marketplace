-- Phase 3 Vendor Operations: multi-warehouse inventory upgrade.
-- LOCAL/STAGING REVIEW ONLY. Do not apply to production until separately approved.

begin;

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
    '"Inventory"',
    '"StockMovement"',
    '"StockReservation"',
    '"Product"',
    '"ProductVariant"',
    '"Vendor"',
    '"VendorWarehouse"',
    '"Order"',
    '"OrderItem"',
    '"AuthIdentityMapping"'
  ]) as required(table_name)
  where to_regclass('public.' || table_name) is null;

  if missing_tables is not null then
    raise exception 'Phase-3 inventory migration aborted. Required tables are missing: %', missing_tables;
  end if;

  if to_regprocedure('private.zylo_is_admin()') is null then
    raise exception 'Phase-3 inventory migration aborted. Required admin helper private.zylo_is_admin() is missing.';
  end if;

  if to_regprocedure('private.zylo_auth_owns_vendor(text)') is null then
    raise exception 'Phase-3 inventory migration aborted. Required vendor ownership helper private.zylo_auth_owns_vendor(text) is missing.';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'StockMovementType') then
    alter type public."StockMovementType" add value if not exists 'STOCK_RECEIVED';
    alter type public."StockMovementType" add value if not exists 'DAMAGED_STOCK';
  end if;
end $$;

alter table public."Inventory"
  add column if not exists "variantId" text references public."ProductVariant"("id") on delete set null on update cascade,
  add column if not exists "openingStock" integer not null default 0,
  add column if not exists "receivedStock" integer not null default 0,
  add column if not exists "damagedStock" integer not null default 0;

alter table public."StockMovement"
  add column if not exists "variantId" text references public."ProductVariant"("id") on delete set null on update cascade,
  add column if not exists "reasonCode" text;

alter table public."StockReservation"
  add column if not exists "warehouseId" text references public."VendorWarehouse"("id") on delete set null on update cascade,
  add column if not exists "variantId" text references public."ProductVariant"("id") on delete set null on update cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Inventory_openingStock_nonnegative'
      and conrelid = 'public."Inventory"'::regclass
  ) then
    alter table public."Inventory"
      add constraint "Inventory_openingStock_nonnegative" check ("openingStock" >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'Inventory_receivedStock_nonnegative'
      and conrelid = 'public."Inventory"'::regclass
  ) then
    alter table public."Inventory"
      add constraint "Inventory_receivedStock_nonnegative" check ("receivedStock" >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'Inventory_damagedStock_nonnegative'
      and conrelid = 'public."Inventory"'::regclass
  ) then
    alter table public."Inventory"
      add constraint "Inventory_damagedStock_nonnegative" check ("damagedStock" >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'StockMovement_reasonCode_allowed'
      and conrelid = 'public."StockMovement"'::regclass
  ) then
    alter table public."StockMovement"
      add constraint "StockMovement_reasonCode_allowed"
      check (
        "reasonCode" is null or "reasonCode" in (
          'OPENING_STOCK',
          'PURCHASE_RECEIPT',
          'STOCK_IN',
          'STOCK_OUT',
          'DAMAGED_STOCK',
          'MANUAL_ADJUSTMENT',
          'WAREHOUSE_ASSIGNMENT',
          'ORDER_RESERVATION',
          'ORDER_CONVERSION',
          'ORDER_RELEASE',
          'ORDER_RETURN',
          'ADMIN_ADJUSTMENT',
          'VENDOR_ADJUSTMENT',
          'LEGACY_SYNC'
        )
      ) not valid;
  end if;
end $$;

create index if not exists "Inventory_variantId_idx" on public."Inventory" ("variantId");
create index if not exists "Inventory_vendorId_warehouseId_idx" on public."Inventory" ("vendorId", "warehouseId");
create index if not exists "StockMovement_variantId_idx" on public."StockMovement" ("variantId");
create index if not exists "StockMovement_reasonCode_idx" on public."StockMovement" ("reasonCode");
create index if not exists "StockMovement_vendorId_warehouseId_idx" on public."StockMovement" ("vendorId", "warehouseId");
create index if not exists "StockReservation_warehouseId_idx" on public."StockReservation" ("warehouseId");
create index if not exists "StockReservation_variantId_idx" on public."StockReservation" ("variantId");

comment on column public."Inventory"."warehouseId" is
  'Phase-2/3 nullable warehouse assignment. Null means Unassigned / Legacy Stock.';
comment on column public."Inventory"."variantId" is
  'Phase-3 nullable variant context only. Inventory remains product-unique in this phase.';
comment on column public."Inventory"."openingStock" is
  'Phase-3 opening stock bucket captured at inventory-row creation or migration review.';
comment on column public."Inventory"."receivedStock" is
  'Phase-3 cumulative purchased/received stock bucket.';
comment on column public."Inventory"."damagedStock" is
  'Phase-3 damaged stock bucket deducted from available stock.';
comment on column public."StockMovement"."warehouseId" is
  'Phase-2/3 nullable warehouse context for inventory history.';
comment on column public."StockMovement"."variantId" is
  'Phase-3 nullable variant context for inventory history.';
comment on column public."StockMovement"."reasonCode" is
  'Phase-3 typed stock movement reason code.';
comment on column public."StockReservation"."warehouseId" is
  'Phase-3 nullable warehouse context for reserved stock.';
comment on column public."StockReservation"."variantId" is
  'Phase-3 nullable variant context for reserved stock.';

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'Inventory'
      and indexname = 'Inventory_productId_key'
  ) then
    raise exception 'Phase-3 inventory migration aborted. Existing Inventory product uniqueness is missing.';
  end if;
end $$;

commit;
