import { describe, expect, it } from "vitest";
import { parseBulkProductCsv, parseCsvText } from "@/lib/bulk-product-csv";

describe("bulk product CSV parsing", () => {
  it("parses quoted CSV values with commas", () => {
    const rows = parseCsvText('Product Name,Description\n"Shirt, Blue","Soft, cotton"\n');

    expect(rows).toEqual([
      ["Product Name", "Description"],
      ["Shirt, Blue", "Soft, cotton"],
    ]);
  });

  it("normalizes headers for bulk product rows", () => {
    const rows = parseBulkProductCsv(
      [
        "Product Name,Vendor Price,Image URLs",
        "Stylish T-Shirt,250,https://example.com/a.jpg | https://example.com/b.jpg",
      ].join("\n"),
    );

    expect(rows).toEqual([
      {
        rowNumber: 2,
        row: {
          "product name": "Stylish T-Shirt",
          "vendor price": "250",
          "image urls": "https://example.com/a.jpg | https://example.com/b.jpg",
        },
      },
    ]);
  });
});
