-- Rollback for Phase 3 multi-warehouse inventory metadata.
-- Removes only objects introduced by 20260817000100_multi_warehouse_inventory_phase3.sql.

begin;

drop index if exists public."StockReservation_variantId_idx";
drop index if exists public."StockReservation_warehouseId_idx";
drop index if exists public."StockMovement_vendorId_warehouseId_idx";
drop index if exists public."StockMovement_reasonCode_idx";
drop index if exists public."StockMovement_variantId_idx";
drop index if exists public."Inventory_vendorId_warehouseId_idx";
drop index if exists public."Inventory_variantId_idx";

alter table if exists public."StockMovement"
  drop constraint if exists "StockMovement_reasonCode_allowed";

alter table if exists public."Inventory"
  drop constraint if exists "Inventory_damagedStock_nonnegative",
  drop constraint if exists "Inventory_receivedStock_nonnegative",
  drop constraint if exists "Inventory_openingStock_nonnegative";

alter table if exists public."StockReservation"
  drop column if exists "variantId",
  drop column if exists "warehouseId";

alter table if exists public."StockMovement"
  drop column if exists "reasonCode",
  drop column if exists "variantId";

alter table if exists public."Inventory"
  drop column if exists "damagedStock",
  drop column if exists "receivedStock",
  drop column if exists "openingStock",
  drop column if exists "variantId";

commit;
