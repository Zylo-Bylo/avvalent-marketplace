-- Safe only before P3 writes return receipt/QC data.

begin;

drop index if exists public."ReturnStockDisposition_processedAt_idx";
drop index if exists public."ReturnStockDisposition_disposition_idx";
drop index if exists public."ReturnStockDisposition_receiptItemId_idx";
drop index if exists public."ReturnReceiptItem_restorationWarehouseId_idx";
drop index if exists public."ReturnReceiptItem_variantId_idx";
drop index if exists public."ReturnReceiptItem_productId_idx";
drop index if exists public."ReturnReceiptItem_orderItemId_idx";
drop index if exists public."ReturnReceipt_qcCompletedAt_idx";
drop index if exists public."ReturnReceipt_receivedAt_idx";
drop index if exists public."ReturnReceipt_status_idx";
drop index if exists public."ReturnReceipt_orderId_idx";
drop index if exists public."OrderItem_fulfillmentWarehouseId_idx";
drop index if exists public."StockMovement_returnDispositionId_key";

alter table if exists public."ReturnStockDisposition"
  drop constraint if exists "ReturnStockDisposition_stockMovementId_fkey";

alter table if exists public."StockMovement"
  drop column if exists "returnDispositionId";

alter table if exists public."OrderItem"
  drop column if exists "fulfillmentWarehouseId";

drop table if exists public."ReturnStockDisposition";
drop table if exists public."ReturnReceiptItem";
drop table if exists public."ReturnReceipt";

drop type if exists public."ReturnStockDispositionType";
drop type if exists public."ReturnReceiptStatus";

commit;
