export type BulkResolverSubcategory = {
  id: string;
  name: string;
  categoryId: string;
};

export type BulkResolverCategory = {
  id: string;
  name: string;
  subcategories?: BulkResolverSubcategory[];
};

export type BulkCategoryResolution = {
  category?: BulkResolverCategory;
  subcategory?: BulkResolverSubcategory;
  message?: string;
};

export function normalizeBulkCategoryLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenStem(token: string) {
  if (token === "lehnga") return "lehenga";
  if (token === "kurtas" || token === "kurtis") return "kurti";
  if (token === "kurta") return "kurti";
  if (token === "sarees") return "saree";
  if (token === "lehengas") return "lehenga";
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
}

function tokens(value: string) {
  return normalizeBulkCategoryLookup(value)
    .split(" ")
    .filter(Boolean)
    .map(tokenStem);
}

function hasAnyToken(value: string, expected: string[]) {
  const valueTokens = new Set(tokens(value));
  return expected.some((item) => valueTokens.has(tokenStem(item)));
}

function findCategoryByName(categories: BulkResolverCategory[], names: string[]) {
  const normalizedNames = names.map(normalizeBulkCategoryLookup);
  return categories.find((category) =>
    normalizedNames.includes(normalizeBulkCategoryLookup(category.name)),
  );
}

function findSubcategoryByName(category: BulkResolverCategory, names: string[]) {
  const normalizedNames = names.map(normalizeBulkCategoryLookup);
  return (category.subcategories || []).find((subcategory) =>
    normalizedNames.includes(normalizeBulkCategoryLookup(subcategory.name)),
  );
}

function scoreSubcategory(subcategory: BulkResolverSubcategory, subcategoryName: string) {
  const inputTokens = new Set(tokens(subcategoryName));
  const candidateTokens = tokens(subcategory.name);
  const overlap = candidateTokens.filter((token) => inputTokens.has(token)).length;

  if (overlap === 0) {
    return 0;
  }

  return overlap * 10 - Math.abs(candidateTokens.length - inputTokens.size);
}

function findBestSubcategory(category: BulkResolverCategory, subcategoryName: string) {
  const normalized = normalizeBulkCategoryLookup(subcategoryName);
  const exact = findSubcategoryByName(category, [subcategoryName]);

  if (exact) {
    return exact;
  }

  const subcategories = category.subcategories || [];

  if (hasAnyToken(normalized, ["saree"])) {
    return findSubcategoryByName(category, ["Sarees", "Saree"]);
  }

  if (hasAnyToken(normalized, ["lehenga", "lehnga"])) {
    return findSubcategoryByName(category, ["Lehengas", "Lehenga"]);
  }

  if (hasAnyToken(normalized, ["kurti", "kurta"])) {
    if (hasAnyToken(normalized, ["set", "sets", "combo"])) {
      return findSubcategoryByName(category, ["Kurti Combo Sets", "Kurta Sets", "Kurtis"]);
    }

    return findSubcategoryByName(category, ["Kurtis", "Short Kurtis", "Kurta Sets"]);
  }

  return subcategories
    .map((subcategory) => ({
      score: scoreSubcategory(subcategory, subcategoryName),
      subcategory,
    }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)[0]?.subcategory;
}

function resolveLegacyCategory(
  categories: BulkResolverCategory[],
  categoryName: string,
  subcategoryName: string,
) {
  if (hasAnyToken(subcategoryName, ["saree", "lehenga", "lehnga"])) {
    return findCategoryByName(categories, ["Lehenga & Sarees", "Lehenga Sarees"]);
  }

  if (hasAnyToken(subcategoryName, ["kurti", "kurta"])) {
    return findCategoryByName(categories, ["Kurtis"]);
  }

  const combined = `${categoryName} ${subcategoryName}`;

  if (hasAnyToken(combined, ["kurti", "kurta"])) {
    return findCategoryByName(categories, ["Kurtis"]);
  }

  if (hasAnyToken(combined, ["saree", "lehenga", "lehnga"])) {
    return findCategoryByName(categories, ["Lehenga & Sarees", "Lehenga Sarees"]);
  }

  if (hasAnyToken(categoryName, ["men"])) {
    return findCategoryByName(categories, ["Men's", "Mens", "Men"]);
  }

  if (hasAnyToken(categoryName, ["kid", "kids", "toy", "toys"])) {
    return findCategoryByName(categories, ["kids & Toys", "Kids & Toys"]);
  }

  if (hasAnyToken(categoryName, ["western"])) {
    return findCategoryByName(categories, ["Women Western Dresses", "Women Western"]);
  }

  if (hasAnyToken(categoryName, ["beauty"])) {
    return findCategoryByName(categories, ["Beauty & Personal Care", "Beauty & Health"]);
  }

  return undefined;
}

export function resolveBulkCategory(
  categories: BulkResolverCategory[],
  categoryName: string,
  subcategoryName: string,
): BulkCategoryResolution {
  const exactCategory = findCategoryByName(categories, [categoryName]);
  const category =
    exactCategory || resolveLegacyCategory(categories, categoryName, subcategoryName);
  const subcategory = category && subcategoryName
    ? findBestSubcategory(category, subcategoryName)
    : undefined;

  const mapped =
    category &&
    (normalizeBulkCategoryLookup(category.name) !== normalizeBulkCategoryLookup(categoryName) ||
      (subcategory &&
        normalizeBulkCategoryLookup(subcategory.name) !==
          normalizeBulkCategoryLookup(subcategoryName)));

  return {
    category,
    subcategory,
    message: mapped
      ? `Mapped to ${[category?.name, subcategory?.name].filter(Boolean).join(" / ")}`
      : "",
  };
}
