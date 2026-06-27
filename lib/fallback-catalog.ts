import catalog from '@/data/fallback-catalog.json';

type FallbackProduct = (typeof catalog.products)[number];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isDatabaseOpenError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes('SQLITE_CANTOPEN') ||
      error.message.includes('unable to open database file'))
  );
}

export function shouldUseFallbackCatalog(error: unknown) {
  return (
    isDatabaseOpenError(error) ||
    (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL)
  );
}

export function getFallbackCategories() {
  return catalog.categories.map((category) => ({
    ...category,
    subcategories: catalog.subcategories.filter(
      (subcategory) => subcategory.categoryId === category.id
    ),
  }));
}

export function getFallbackProducts(searchParams: URLSearchParams) {
  const category = searchParams.get('category');
  const categoryId = searchParams.get('categoryId');
  const subcategoryId = searchParams.get('subcategoryId');
  const search = searchParams.get('search');
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  const includeOutOfStock = searchParams.get('includeOutOfStock') === 'true';
  const sort = searchParams.get('sort') || 'newest';
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let products = [...catalog.products] as FallbackProduct[];

  if (!includeOutOfStock) {
    products = products.filter((product) => product.inventory > 0);
  }

  if (category) {
    products = products.filter(
      (product) => normalize(product.category?.name || '') === normalize(category)
    );
  }

  if (categoryId) {
    products = products.filter((product) => product.categoryId === categoryId);
  }

  if (subcategoryId) {
    products = products.filter((product) => product.subcategoryId === subcategoryId);
  }

  if (search) {
    const query = normalize(search);
    products = products.filter(
      (product) =>
        normalize(product.name).includes(query) ||
        normalize(product.description || '').includes(query)
    );
  }

  if (minPrice) {
    products = products.filter((product) => product.price >= Number(minPrice));
  }

  if (maxPrice) {
    products = products.filter((product) => product.price <= Number(maxPrice));
  }

  products.sort((a, b) => {
    if (sort === 'price-asc') {
      return a.price - b.price;
    }

    if (sort === 'price-desc') {
      return b.price - a.price;
    }

    if (sort === 'stock-low') {
      return a.inventory - b.inventory;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const total = products.length;

  return {
    products: products.slice(offset, offset + limit),
    total,
    hasMore: offset + limit < total,
  };
}

export function getFallbackProductById(id: string) {
  return catalog.products.find((product) => product.id === id) || null;
}

export function getFallbackProductBySlug(slug: string) {
  return catalog.products.find((product) => product.slug === slug) || null;
}
