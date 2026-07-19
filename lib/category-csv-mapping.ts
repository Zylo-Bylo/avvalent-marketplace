export type CsvCategoryNode = {
  id: string;
  name: string;
  slug: string;
  subcategories?: Array<{
    id: string;
    name: string;
    slug: string;
    productTypes?: Array<{ id: string; name: string; slug: string }>;
  }>;
};

export type CsvCategoryRow = {
  categoryName?: string;
  categorySlug?: string;
  categoryId?: string;
  subcategoryName?: string;
  productTypeName?: string;
};

export type CsvMappingResult = {
  row: CsvCategoryRow;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  productTypeId: string | null;
  productTypeName: string | null;
  status: 'matched' | 'partial' | 'missing';
  notes: string[];
  spellingSuggestion?: string;
};

export function normalizeCategoryKey(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= b.length; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      matrix[row][column] =
        a[row - 1] === b[column - 1]
          ? matrix[row - 1][column - 1]
          : Math.min(
              matrix[row - 1][column - 1] + 1,
              matrix[row][column - 1] + 1,
              matrix[row - 1][column] + 1,
            );
    }
  }

  return matrix[a.length][b.length];
}

function nearestName(input: string, candidates: string[]) {
  const normalized = normalizeCategoryKey(input);
  if (!normalized) return undefined;

  const best = candidates
    .map((candidate) => ({
      candidate,
      distance: levenshtein(normalized, normalizeCategoryKey(candidate)),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  return best && best.distance <= Math.max(2, Math.ceil(normalized.length * 0.25))
    ? best.candidate
    : undefined;
}

export function mapCsvCategories(
  rows: CsvCategoryRow[],
  categories: CsvCategoryNode[],
): CsvMappingResult[] {
  const categoryNames = categories.map((category) => category.name);

  return rows.map((row) => {
    const notes: string[] = [];
    const categoryKey = normalizeCategoryKey(row.categoryName || row.categorySlug || row.categoryId);
    const subcategoryKey = normalizeCategoryKey(row.subcategoryName);
    const productTypeKey = normalizeCategoryKey(row.productTypeName);

    const category =
      categories.find(
        (item) =>
          normalizeCategoryKey(item.id) === categoryKey ||
          normalizeCategoryKey(item.name) === categoryKey ||
          normalizeCategoryKey(item.slug) === categoryKey,
      ) || null;

    if (!category) {
      const spellingSuggestion = nearestName(row.categoryName || '', categoryNames);
      notes.push(spellingSuggestion ? `Possible spelling match: ${spellingSuggestion}` : 'Missing category');
      return {
        row,
        categoryId: null,
        categoryName: null,
        subcategoryId: null,
        subcategoryName: null,
        productTypeId: null,
        productTypeName: null,
        status: 'missing',
        notes,
        spellingSuggestion,
      };
    }

    const subcategory =
      category.subcategories?.find((item) => normalizeCategoryKey(item.name) === subcategoryKey) || null;
    const productType =
      subcategory?.productTypes?.find((item) => normalizeCategoryKey(item.name) === productTypeKey) || null;

    if (subcategoryKey && !subcategory) notes.push('Missing subcategory');
    if (subcategory && productTypeKey && !productType) notes.push('Missing product type');

    return {
      row,
      categoryId: category.id,
      categoryName: category.name,
      subcategoryId: subcategory?.id || null,
      subcategoryName: subcategory?.name || null,
      productTypeId: productType?.id || null,
      productTypeName: productType?.name || null,
      status: notes.length ? 'partial' : 'matched',
      notes: notes.length ? notes : ['Matched existing category'],
    };
  });
}
