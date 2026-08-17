-- Phase 2 Vendor Operations: vendor warehouse extension.
-- Staging first. Do not run on production until reviewed and approved.

begin;

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
    '"Vendor"',
    '"VendorAddress"',
    '"Inventory"',
    '"StockMovement"',
    '"AuthIdentityMapping"'
  ]) as required(table_name)
  where to_regclass('public.' || table_name) is null;

  if missing_tables is not null then
    raise exception 'Vendor warehouse phase-2 migration aborted. Required tables are missing: %', missing_tables;
  end if;

  if to_regprocedure('private.zylo_is_admin()') is null then
    raise exception 'Vendor warehouse phase-2 migration aborted. Required admin helper private.zylo_is_admin() is missing.';
  end if;

  if to_regprocedure('private.zylo_auth_owns_vendor(text)') is null then
    raise exception 'Vendor warehouse phase-2 migration aborted. Required vendor ownership helper private.zylo_auth_owns_vendor(text) is missing.';
  end if;
end $$;

create table if not exists public."VendorWarehouse" (
  "id" text primary key,
  "vendorId" text not null references public."Vendor"("id") on delete cascade on update cascade,
  "code" text not null,
  "name" text not null,
  "contactPerson" text,
  "phone" text,
  "email" text,
  "addressId" text references public."VendorAddress"("id") on delete set null on update cascade,
  "capacity" integer,
  "isDefault" boolean not null default false,
  "isActive" boolean not null default true,
  "status" text not null default 'PENDING' check ("status" in ('PENDING', 'APPROVED', 'DEACTIVATED')),
  "notes" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

alter table public."Inventory"
  add column if not exists "warehouseId" text references public."VendorWarehouse"("id") on delete set null on update cascade;

alter table public."StockMovement"
  add column if not exists "warehouseId" text references public."VendorWarehouse"("id") on delete set null on update cascade;

create unique index if not exists "VendorWarehouse_vendorId_code_key" on public."VendorWarehouse" ("vendorId", "code");
create unique index if not exists "VendorWarehouse_one_default_active_idx" on public."VendorWarehouse" ("vendorId") where "isDefault" = true and "isActive" = true;
create index if not exists "VendorWarehouse_vendorId_idx" on public."VendorWarehouse" ("vendorId");
create index if not exists "VendorWarehouse_vendorId_isDefault_idx" on public."VendorWarehouse" ("vendorId", "isDefault");
create index if not exists "VendorWarehouse_vendorId_isActive_idx" on public."VendorWarehouse" ("vendorId", "isActive");
create index if not exists "VendorWarehouse_status_idx" on public."VendorWarehouse" ("status");
create index if not exists "VendorWarehouse_addressId_idx" on public."VendorWarehouse" ("addressId");
create index if not exists "VendorWarehouse_createdAt_idx" on public."VendorWarehouse" ("createdAt");
create index if not exists "Inventory_warehouseId_idx" on public."Inventory" ("warehouseId");
create index if not exists "StockMovement_warehouseId_idx" on public."StockMovement" ("warehouseId");

revoke all on table public."VendorWarehouse" from public, anon, authenticated;

grant select (
  "id",
  "vendorId",
  "code",
  "name",
  "contactPerson",
  "phone",
  "email",
  "addressId",
  "capacity",
  "isDefault",
  "isActive",
  "status",
  "notes",
  "createdAt",
  "updatedAt"
) on table public."VendorWarehouse" to authenticated;

grant insert (
  "id",
  "vendorId",
  "code",
  "name",
  "contactPerson",
  "phone",
  "email",
  "addressId",
  "capacity",
  "isDefault",
  "isActive",
  "status",
  "notes",
  "createdAt",
  "updatedAt"
) on table public."VendorWarehouse" to authenticated;

grant update (
  "code",
  "name",
  "contactPerson",
  "phone",
  "email",
  "addressId",
  "capacity",
  "isDefault",
  "isActive",
  "status",
  "notes",
  "updatedAt"
) on table public."VendorWarehouse" to authenticated;

grant delete on table public."VendorWarehouse" to authenticated;

drop policy if exists "vendor_warehouse_select_own" on public."VendorWarehouse";
drop policy if exists "vendor_warehouse_insert_own" on public."VendorWarehouse";
drop policy if exists "vendor_warehouse_update_own" on public."VendorWarehouse";
drop policy if exists "vendor_warehouse_delete_own" on public."VendorWarehouse";
drop policy if exists "admin_vendor_warehouse_all" on public."VendorWarehouse";

create policy "vendor_warehouse_select_own" on public."VendorWarehouse"
  for select to authenticated
  using (private.zylo_auth_owns_vendor("vendorId"));

create policy "vendor_warehouse_insert_own" on public."VendorWarehouse"
  for insert to authenticated
  with check (
    "status" = 'PENDING'
    and private.zylo_auth_owns_vendor("vendorId")
  );

create policy "vendor_warehouse_update_own" on public."VendorWarehouse"
  for update to authenticated
  using (
    "status" = 'PENDING'
    and private.zylo_auth_owns_vendor("vendorId")
  )
  with check (
    "status" = 'PENDING'
    and private.zylo_auth_owns_vendor("vendorId")
  );

create policy "vendor_warehouse_delete_own" on public."VendorWarehouse"
  for delete to authenticated
  using (
    "status" = 'PENDING'
    and private.zylo_auth_owns_vendor("vendorId")
  );

create policy "admin_vendor_warehouse_all" on public."VendorWarehouse"
  for all to authenticated
  using (private.zylo_is_admin())
  with check (private.zylo_is_admin());

alter table public."VendorWarehouse" enable row level security;

commit;
