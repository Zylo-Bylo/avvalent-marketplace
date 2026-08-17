-- Rollback for Phase 2 Vendor Operations warehouse extension.
-- Removes only objects created by 20260725000100_vendor_warehouse_phase2.sql.

begin;

drop index if exists public."StockMovement_warehouseId_idx";
drop index if exists public."Inventory_warehouseId_idx";

alter table if exists public."StockMovement"
  drop column if exists "warehouseId";

alter table if exists public."Inventory"
  drop column if exists "warehouseId";

drop table if exists public."VendorWarehouse";

commit;
