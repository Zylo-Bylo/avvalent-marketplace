export type BulkProductCsvRow = Record<string, string>;

export function normalizeBulkHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseCsvText(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

export function parseBulkProductCsv(text: string) {
  const [headerRow, ...dataRows] = parseCsvText(text);

  if (!headerRow?.length) {
    return [];
  }

  const headers = headerRow.map(normalizeBulkHeader);

  return dataRows.map((values, rowIndex) => {
    const row: BulkProductCsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    return {
      rowNumber: rowIndex + 2,
      row,
    };
  });
}
