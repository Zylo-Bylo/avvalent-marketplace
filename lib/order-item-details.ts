export type OrderProductForDetails = {
  name?: string | null;
  sku?: string | null;
  description?: string | null;
  weightGrams?: number | null;
  packageSize?: string | null;
  category?: { name?: string | null } | null;
  subcategory?: { name?: string | null } | null;
};

export type OrderItemForDetails = {
  sizeLabel?: string | null;
  numericSize?: string | null;
  variantColor?: string | null;
  variantSku?: string | null;
  product?: OrderProductForDetails | null;
};

function clean(value?: string | number | null) {
  return String(value ?? "").trim();
}

function detailFromDescription(description: string | null | undefined, labels: string[]) {
  const text = description || "";

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`^${escaped}\\s*:\\s*(.+)$`, "im"));
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return "";
}

export function getOrderItemDetails(item: OrderItemForDetails) {
  const product = item.product;
  const description = product?.description || "";
  const sizeParts = [item.sizeLabel, item.numericSize && item.numericSize !== item.sizeLabel ? item.numericSize : ""]
    .map(clean)
    .filter(Boolean);

  return {
    sku: clean(item.variantSku) || clean(product?.sku),
    size: sizeParts.join(" / ") || detailFromDescription(description, ["Size", "Available sizes"]),
    color: clean(item.variantColor) || detailFromDescription(description, ["Color", "Colour"]),
    brand: detailFromDescription(description, ["Brand"]),
    itemType:
      detailFromDescription(description, ["Product type", "Part type"]) ||
      clean(product?.subcategory?.name) ||
      clean(product?.category?.name),
    material:
      detailFromDescription(description, ["Material", "Fabric type", "Material / Build"]),
    dimensions: detailFromDescription(description, ["Dimensions", "Seating / capacity"]),
    weight: product?.weightGrams ? `${product.weightGrams} g` : "",
    packageSize: clean(product?.packageSize),
    hsn: detailFromDescription(description, ["HSN Code"]),
    gst: detailFromDescription(description, ["GST"]),
  };
}

export function getOrderItemDetailPairs(item: OrderItemForDetails) {
  const details = getOrderItemDetails(item);

  return [
    ["Size", details.size],
    ["Color", details.color],
    ["Brand", details.brand],
    ["Item Type", details.itemType],
    ["SKU", details.sku],
    ["Weight", details.weight],
    ["Material", details.material],
    ["Dimensions", details.dimensions],
    ["Package", details.packageSize],
    ["HSN", details.hsn],
    ["GST", details.gst],
  ].filter(([, value]) => clean(value)) as Array<[string, string]>;
}
