-- Return receipt/QC foundation. Review and apply separately; never from Vercel build.

begin;

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
    '"User"', '"Order"', '"OrderItem"', '"Product"', '"ProductVariant"',
    '"VendorWarehouse"', '"StockMovement"', '"ReturnRefundRequest"'
  ]) as required(table_name)
  where to_regclass('public.' || table_name) is null;

  if missing_tables is not null then
    raise exception 'Return receipt/QC migration aborted. Required tables are missing: %', missing_tables;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ReturnReceiptStatus') then
    create type public."ReturnReceiptStatus" as enum ('PENDING', 'RECEIVED', 'QC_COMPLETED');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ReturnStockDispositionType') then
    create type public."ReturnStockDispositionType" as enum ('RESELLABLE', 'DAMAGED', 'REJECTED');
  end if;
end $$;

create table if not exists public."ReturnReceipt" (
  "id" text primary key,
  "returnRequestId" text not null unique,
  "orderId" text not null references public."Order"("id") on delete restrict on update cascade,
  "status" public."ReturnReceiptStatus" not null default 'PENDING',
  "receivedAt" timestamp(3),
  "receivedByUserId" text references public."User"("id") on delete restrict on update cascade,
  "qcCompletedAt" timestamp(3),
  "qcCompletedByUserId" text references public."User"("id") on delete restrict on update cascade,
  "qcNote" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);

create table if not exists public."ReturnReceiptItem" (
  "id" text primary key,
  "receiptId" text not null references public."ReturnReceipt"("id") on delete restrict on update cascade,
  "orderItemId" text not null references public."OrderItem"("id") on delete restrict on update cascade,
  "productId" text not null references public."Product"("id") on delete restrict on update cascade,
  "variantId" text references public."ProductVariant"("id") on delete restrict on update cascade,
  "orderedQuantity" integer not null,
  "receivedQuantity" integer not null,
  "restorationWarehouseId" text not null references public."VendorWarehouse"("id") on delete restrict on update cascade,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,
  constraint "ReturnReceiptItem_quantities_valid" check (
    "orderedQuantity" > 0 and
    "receivedQuantity" >= 0 and
    "receivedQuantity" <= "orderedQuantity"
  ),
  constraint "ReturnReceiptItem_receiptId_orderItemId_key" unique ("receiptId", "orderItemId")
);

create table if not exists public."ReturnStockDisposition" (
  "id" text primary key,
  "receiptItemId" text not null references public."ReturnReceiptItem"("id") on delete restrict on update cascade,
  "disposition" public."ReturnStockDispositionType" not null,
  "quantity" integer not null,
  "processedAt" timestamp(3),
  "processedByUserId" text references public."User"("id") on delete restrict on update cascade,
  "stockMovementId" text unique,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,
  constraint "ReturnStockDisposition_quantity_positive" check ("quantity" > 0),
  constraint "ReturnStockDisposition_receiptItemId_disposition_key" unique ("receiptItemId", "disposition")
);

alter table public."OrderItem"
  add column if not exists "fulfillmentWarehouseId" text references public."VendorWarehouse"("id") on delete restrict on update cascade;

alter table public."StockMovement"
  add column if not exists "returnDispositionId" text references public."ReturnStockDisposition"("id") on delete restrict on update cascade;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ReturnStockDisposition_stockMovementId_fkey') then
    alter table public."ReturnStockDisposition"
      add constraint "ReturnStockDisposition_stockMovementId_fkey"
      foreign key ("stockMovementId") references public."StockMovement"("id") on delete restrict on update cascade;
  end if;
end $$;

create unique index if not exists "StockMovement_returnDispositionId_key" on public."StockMovement" ("returnDispositionId");
create unique index if not exists "ReturnStockDisposition_stockMovementId_key" on public."ReturnStockDisposition" ("stockMovementId");
create index if not exists "OrderItem_fulfillmentWarehouseId_idx" on public."OrderItem" ("fulfillmentWarehouseId");
create index if not exists "ReturnReceipt_orderId_idx" on public."ReturnReceipt" ("orderId");
create index if not exists "ReturnReceipt_status_idx" on public."ReturnReceipt" ("status");
create index if not exists "ReturnReceipt_receivedAt_idx" on public."ReturnReceipt" ("receivedAt");
create index if not exists "ReturnReceipt_qcCompletedAt_idx" on public."ReturnReceipt" ("qcCompletedAt");
create index if not exists "ReturnReceiptItem_orderItemId_idx" on public."ReturnReceiptItem" ("orderItemId");
create index if not exists "ReturnReceiptItem_productId_idx" on public."ReturnReceiptItem" ("productId");
create index if not exists "ReturnReceiptItem_variantId_idx" on public."ReturnReceiptItem" ("variantId");
create index if not exists "ReturnReceiptItem_restorationWarehouseId_idx" on public."ReturnReceiptItem" ("restorationWarehouseId");
create index if not exists "ReturnStockDisposition_receiptItemId_idx" on public."ReturnStockDisposition" ("receiptItemId");
create index if not exists "ReturnStockDisposition_disposition_idx" on public."ReturnStockDisposition" ("disposition");
create index if not exists "ReturnStockDisposition_processedAt_idx" on public."ReturnStockDisposition" ("processedAt");

comment on table public."ReturnReceipt" is 'Physical return receipt and QC state; raw return request is linked by unique scalar ID.';
comment on column public."ReturnReceiptItem"."restorationWarehouseId" is 'Immutable authoritative warehouse snapshot used by future restoration.';
comment on column public."StockMovement"."returnDispositionId" is 'Unique restoration identity preventing duplicate stock movements.';

commit;
