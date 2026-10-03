-- SQLite-only additive migration for return receipt/QC schema.

ALTER TABLE "OrderItem" ADD COLUMN "fulfillmentWarehouseId" TEXT REFERENCES "VendorWarehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD COLUMN "returnDispositionId" TEXT REFERENCES "ReturnStockDisposition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ReturnReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnRequestId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "receivedAt" DATETIME,
    "receivedByUserId" TEXT,
    "qcCompletedAt" DATETIME,
    "qcCompletedByUserId" TEXT,
    "qcNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReturnReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnReceipt_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnReceipt_qcCompletedByUserId_fkey" FOREIGN KEY ("qcCompletedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ReturnReceiptItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "orderedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL,
    "restorationWarehouseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReturnReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "ReturnReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnReceiptItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnReceiptItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnReceiptItem_restorationWarehouseId_fkey" FOREIGN KEY ("restorationWarehouseId") REFERENCES "VendorWarehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ReturnStockDisposition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptItemId" TEXT NOT NULL,
    "disposition" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "processedAt" DATETIME,
    "processedByUserId" TEXT,
    "stockMovementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReturnStockDisposition_receiptItemId_fkey" FOREIGN KEY ("receiptItemId") REFERENCES "ReturnReceiptItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnStockDisposition_processedByUserId_fkey" FOREIGN KEY ("processedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnStockDisposition_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "StockMovement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReturnReceipt_returnRequestId_key" ON "ReturnReceipt"("returnRequestId");
CREATE INDEX "ReturnReceipt_orderId_idx" ON "ReturnReceipt"("orderId");
CREATE INDEX "ReturnReceipt_status_idx" ON "ReturnReceipt"("status");
CREATE INDEX "ReturnReceipt_receivedAt_idx" ON "ReturnReceipt"("receivedAt");
CREATE INDEX "ReturnReceipt_qcCompletedAt_idx" ON "ReturnReceipt"("qcCompletedAt");

CREATE UNIQUE INDEX "ReturnReceiptItem_receiptId_orderItemId_key" ON "ReturnReceiptItem"("receiptId", "orderItemId");
CREATE INDEX "ReturnReceiptItem_orderItemId_idx" ON "ReturnReceiptItem"("orderItemId");
CREATE INDEX "ReturnReceiptItem_productId_idx" ON "ReturnReceiptItem"("productId");
CREATE INDEX "ReturnReceiptItem_variantId_idx" ON "ReturnReceiptItem"("variantId");
CREATE INDEX "ReturnReceiptItem_restorationWarehouseId_idx" ON "ReturnReceiptItem"("restorationWarehouseId");

CREATE UNIQUE INDEX "ReturnStockDisposition_receiptItemId_disposition_key" ON "ReturnStockDisposition"("receiptItemId", "disposition");
CREATE UNIQUE INDEX "ReturnStockDisposition_stockMovementId_key" ON "ReturnStockDisposition"("stockMovementId");
CREATE INDEX "ReturnStockDisposition_receiptItemId_idx" ON "ReturnStockDisposition"("receiptItemId");
CREATE INDEX "ReturnStockDisposition_disposition_idx" ON "ReturnStockDisposition"("disposition");
CREATE INDEX "ReturnStockDisposition_processedAt_idx" ON "ReturnStockDisposition"("processedAt");

CREATE UNIQUE INDEX "StockMovement_returnDispositionId_key" ON "StockMovement"("returnDispositionId");
CREATE INDEX "OrderItem_fulfillmentWarehouseId_idx" ON "OrderItem"("fulfillmentWarehouseId");
