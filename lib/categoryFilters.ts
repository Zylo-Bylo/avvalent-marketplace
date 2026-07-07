export type CategoryFilterType = 'select' | 'price' | 'sort';

export type CategoryFilter = {
  key: string;
  label: string;
  type?: CategoryFilterType;
  options: Array<{
    label: string;
    value: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
};

export type CategoryShortcut = {
  label: string;
  slug: string;
  href: string;
};

export type SizeGuideType =
  | 'mens-shirt'
  | 'mens-tshirt'
  | 'jeans-trouser'
  | 'kurti'
  | 'saree'
  | 'shoes'
  | 'kids'
  | 'fashion';

export type CategoryListingConfig = {
  categorySlug: string;
  displayName: string;
  breadcrumb: string[];
  bannerImage: string;
  shortcutButtons: CategoryShortcut[];
  filters: CategoryFilter[];
  sizeGuideType: SizeGuideType;
};

type CategoryRoute = {
  mainSlug: string;
  groupSlug: string;
  partSlug: string;
};

type CategoryContext = {
  mainSlug: string;
  groupSlug: string;
  partSlug: string;
  mainName?: string;
  groupName?: string;
  partName?: string;
};

function toOption(label: string) {
  return {
    label,
    value: slugify(label),
  };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const fashionCategoryRoutes: Record<string, CategoryRoute> = {
  'casual-shirts': { mainSlug: 'men', groupSlug: 'topwear', partSlug: 'casual-shirts' },
  'formal-shirts': { mainSlug: 'men', groupSlug: 'topwear', partSlug: 'formal-shirts' },
  't-shirts': { mainSlug: 'men', groupSlug: 'topwear', partSlug: 't-shirts' },
  'polo-t-shirts': { mainSlug: 'men', groupSlug: 'topwear', partSlug: 'polo-t-shirts' },
  jackets: { mainSlug: 'men', groupSlug: 'topwear', partSlug: 'jackets' },
  hoodies: { mainSlug: 'men', groupSlug: 'topwear', partSlug: 'hoodies' },
  kurtas: { mainSlug: 'men', groupSlug: 'topwear', partSlug: 'kurtas' },
  kurtis: { mainSlug: 'women', groupSlug: 'ethnic-wear', partSlug: 'kurtis' },
  sarees: { mainSlug: 'women', groupSlug: 'ethnic-wear', partSlug: 'sarees' },
  suits: { mainSlug: 'women', groupSlug: 'ethnic-wear', partSlug: 'suits' },
  'western-dresses': { mainSlug: 'women', groupSlug: 'western-wear', partSlug: 'western-dresses' },
  tops: { mainSlug: 'women', groupSlug: 'western-wear', partSlug: 'tops' },
  jeans: { mainSlug: 'women', groupSlug: 'western-wear', partSlug: 'jeans' },
  dupatta: { mainSlug: 'women', groupSlug: 'ethnic-wear', partSlug: 'dupatta' },
  lehenga: { mainSlug: 'women', groupSlug: 'ethnic-wear', partSlug: 'lehenga' },
  'boys-t-shirts': { mainSlug: 'kids', groupSlug: 'clothing', partSlug: 'boys-t-shirts' },
  'girls-dresses': { mainSlug: 'kids', groupSlug: 'clothing', partSlug: 'girls-dresses' },
  'kids-shirts': { mainSlug: 'kids', groupSlug: 'clothing', partSlug: 'kids-shirts' },
  'kids-jeans': { mainSlug: 'kids', groupSlug: 'clothing', partSlug: 'kids-jeans' },
  'ethnic-wear': { mainSlug: 'kids', groupSlug: 'clothing', partSlug: 'ethnic-wear' },
  'school-shoes': { mainSlug: 'kids', groupSlug: 'footwear', partSlug: 'school-shoes' },
  'sports-shoes': { mainSlug: 'footwear', groupSlug: 'men-shoes', partSlug: 'sports-shoes' },
  'casual-shoes': { mainSlug: 'footwear', groupSlug: 'men-shoes', partSlug: 'casual-shoes' },
  'formal-shoes': { mainSlug: 'footwear', groupSlug: 'men-shoes', partSlug: 'formal-shoes' },
  sandals: { mainSlug: 'footwear', groupSlug: 'women-sandals', partSlug: 'sandals' },
  slippers: { mainSlug: 'footwear', groupSlug: 'women-sandals', partSlug: 'slippers' },
  heels: { mainSlug: 'footwear', groupSlug: 'women-sandals', partSlug: 'heels' },
  'kids-shoes': { mainSlug: 'footwear', groupSlug: 'kids-shoes', partSlug: 'kids-shoes' },
};

export function getFashionCategoryHref(categorySlug: string) {
  const route = fashionCategoryRoutes[categorySlug];

  if (!route) {
    return null;
  }

  return `/category/${route.mainSlug}/${route.groupSlug}/${route.partSlug}`;
}

const sortFilter: CategoryFilter = {
  key: 'sort',
  label: 'Sort By',
  type: 'sort',
  options: [
    { label: 'Popular', value: 'popular' },
    { label: 'Newest', value: 'newest' },
    { label: 'Price: Low to High', value: 'price-asc' },
    { label: 'Price: High to Low', value: 'price-desc' },
    { label: 'Trending', value: 'trending' },
  ],
};

const discountFilter: CategoryFilter = {
  key: 'discount',
  label: 'Discount',
  options: [
    { label: '10% and above', value: '10-plus' },
    { label: '20% and above', value: '20-plus' },
    { label: '30% and above', value: '30-plus' },
    { label: 'Deals only', value: 'deals' },
  ],
};

const priceFilter: CategoryFilter = {
  key: 'price',
  label: 'Price',
  type: 'price',
  options: [
    { label: 'Under Rs. 499', value: 'under-499', maxPrice: '499' },
    { label: 'Under Rs. 999', value: 'under-999', maxPrice: '999' },
    { label: 'Rs. 1000 - Rs. 1999', value: '1000-1999', minPrice: '1000', maxPrice: '1999' },
    { label: 'Rs. 2000+', value: '2000-plus', minPrice: '2000' },
  ],
};

const clothingFilters: CategoryFilter[] = [
  { key: 'allDiscount', label: 'All Discount', options: discountFilter.options },
  discountFilter,
  { key: 'category', label: 'Category', options: ['Topwear', 'Bottomwear', 'Ethnic Wear', 'Western Wear'].map(toOption) },
  { key: 'brand', label: 'Brand/Subbrand', options: ['Zylo Select', 'Urban Loom', 'Daily Wear', 'Vendor Brand'].map(toOption) },
  { key: 'occasion', label: 'Occasion', options: ['Casual', 'Office', 'Party', 'Festive', 'Wedding'].map(toOption) },
  { key: 'size', label: 'Size', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map(toOption) },
  priceFilter,
  { key: 'color', label: 'Color', options: ['Black', 'White', 'Blue', 'Pink', 'Green', 'Red', 'Beige'].map(toOption) },
  { key: 'fit', label: 'Fit', options: ['Regular Fit', 'Slim Fit', 'Relaxed Fit', 'Oversized'].map(toOption) },
  { key: 'sleeves', label: 'Sleeves', options: ['Full Sleeve', 'Half Sleeve', 'Sleeveless', '3/4 Sleeve'].map(toOption) },
  { key: 'pattern', label: 'Pattern', options: ['Solid', 'Printed', 'Striped', 'Checked', 'Embroidered'].map(toOption) },
  { key: 'neck', label: 'Neck', options: ['Round Neck', 'V Neck', 'Collar', 'Mandarin Collar'].map(toOption) },
  { key: 'cuffs', label: 'Cuffs', options: ['Button Cuff', 'Ribbed Cuff', 'No Cuff'].map(toOption) },
  { key: 'frontOpening', label: 'Front Opening', options: ['Button', 'Zip', 'Pullover', 'Open Front'].map(toOption) },
  { key: 'material', label: 'Material/Fabric', options: ['Cotton', 'Denim', 'Rayon', 'Polyester', 'Silk', 'Georgette'].map(toOption) },
  { key: 'country', label: 'Country of Origin', options: ['India', 'Imported'].map(toOption) },
  sortFilter,
];

const footwearFilters: CategoryFilter[] = [
  discountFilter,
  { key: 'category', label: 'Category', options: ['Sports Shoes', 'Casual Shoes', 'Formal Shoes', 'Sandals', 'Slippers', 'Heels'].map(toOption) },
  { key: 'brand', label: 'Brand', options: ['Zylo Select', 'Walkmate', 'Urban Step', 'Vendor Brand'].map(toOption) },
  { key: 'size', label: 'Size', options: ['UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'].map(toOption) },
  priceFilter,
  { key: 'color', label: 'Color', options: ['Black', 'Brown', 'White', 'Tan', 'Blue', 'Pink'].map(toOption) },
  { key: 'type', label: 'Type', options: ['Sneakers', 'Loafers', 'Flats', 'Heels', 'Flip Flops'].map(toOption) },
  { key: 'occasion', label: 'Occasion', options: ['Daily', 'Office', 'Party', 'Sports', 'School'].map(toOption) },
  { key: 'soleMaterial', label: 'Sole Material', options: ['Rubber', 'EVA', 'PU', 'TPR', 'Leather'].map(toOption) },
  { key: 'closureType', label: 'Closure Type', options: ['Lace-Up', 'Slip-On', 'Buckle', 'Velcro'].map(toOption) },
  { key: 'heelType', label: 'Heel Type', options: ['Flat', 'Block', 'Wedge', 'Platform', 'Stiletto'].map(toOption) },
  { key: 'country', label: 'Country of Origin', options: ['India', 'Imported'].map(toOption) },
  sortFilter,
];

const kidsFilters: CategoryFilter[] = [
  { key: 'ageGroup', label: 'Age Group', options: ['0-2 years', '2-4 years', '5-8 years', '9-12 years', '13+ years'].map(toOption) },
  { key: 'size', label: 'Size', options: ['XS', 'S', 'M', 'L', 'XL', '2-3Y', '4-5Y', '6-7Y'].map(toOption) },
  { key: 'gender', label: 'Gender', options: ['Boys', 'Girls', 'Unisex'].map(toOption) },
  { key: 'category', label: 'Category', options: ['T-Shirts', 'Dresses', 'Shirts', 'Jeans', 'Ethnic Wear', 'School Shoes'].map(toOption) },
  { key: 'brand', label: 'Brand', options: ['Zylo Kids', 'Little Star', 'School Ready', 'Vendor Brand'].map(toOption) },
  priceFilter,
  { key: 'color', label: 'Color', options: ['Blue', 'Pink', 'Yellow', 'White', 'Black', 'Red'].map(toOption) },
  { key: 'fabric', label: 'Fabric', options: ['Cotton', 'Denim', 'Fleece', 'Rayon', 'Polyester'].map(toOption) },
  { key: 'occasion', label: 'Occasion', options: ['Daily', 'School', 'Party', 'Festive'].map(toOption) },
  { key: 'pattern', label: 'Pattern', options: ['Solid', 'Cartoon', 'Printed', 'Striped', 'Checked'].map(toOption) },
  sortFilter,
];

function shortcuts(labels: string[]) {
  return labels.map((label) => {
    const slug = slugify(label);
    return {
      label,
      slug,
      href: getFashionCategoryHref(slug) || `/products?category=${slug}`,
    };
  });
}

function isFootwear(context: CategoryContext) {
  const text = `${context.mainSlug} ${context.groupSlug} ${context.partSlug}`.toLowerCase();
  return /footwear|shoe|shoes|sandal|sandals|slipper|slippers|heel|heels|flats|flip-flops/.test(text);
}

function isKids(context: CategoryContext) {
  const text = `${context.mainSlug} ${context.groupSlug} ${context.partSlug}`.toLowerCase();
  return /kid|kids|boy|boys|girl|girls|baby|babies|school/.test(text);
}

function isWomen(context: CategoryContext) {
  const text = `${context.mainSlug} ${context.groupSlug} ${context.partSlug}`.toLowerCase();
  return /women|kurti|kurtis|saree|sarees|lehenga|dress|dresses|tops|dupatta|heels|flats/.test(text);
}

function getSizeGuideType(context: CategoryContext): SizeGuideType {
  const text = `${context.mainSlug} ${context.groupSlug} ${context.partSlug}`.toLowerCase();

  if (isKids(context)) return 'kids';
  if (isFootwear(context)) return 'shoes';
  if (/saree/.test(text)) return 'saree';
  if (/kurti|kurtis/.test(text)) return 'kurti';
  if (/jean|trouser|pant/.test(text)) return 'jeans-trouser';
  if (/t-shirt|tshirts|polo/.test(text)) return 'mens-tshirt';
  if (/shirt/.test(text)) return 'mens-shirt';
  return 'fashion';
}

function getBannerImage(context: CategoryContext) {
  if (isFootwear(context)) return '/products/Mens shoes.jpg';
  if (isKids(context)) return '/products/kids wear.jpg';
  if (/saree|lehenga/.test(context.partSlug)) return '/products/lengha.jpg';
  if (/kurti/.test(context.partSlug)) return '/products/Women kurti.jpg';
  if (/t-shirt|tshirts|polo/.test(context.partSlug)) return '/products/t-shirt.jpg';
  return '/hero-banner.png';
}

export function getCategoryListingConfig(context: CategoryContext): CategoryListingConfig {
  const displayName =
    context.partName ||
    context.partSlug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  const breadcrumb = [
    context.mainName || context.mainSlug,
    context.groupName || context.groupSlug,
    displayName,
  ].filter(Boolean);
  const footwear = isFootwear(context);
  const kids = isKids(context);
  const women = isWomen(context);

  return {
    categorySlug: context.partSlug,
    displayName,
    breadcrumb,
    bannerImage: getBannerImage(context),
    shortcutButtons: shortcuts(
      footwear
        ? ['Sports Shoes', 'Casual Shoes', 'Formal Shoes', 'Sandals', 'Slippers', 'Heels', 'Kids Shoes']
        : kids
          ? ['Boys T-Shirts', 'Girls Dresses', 'Kids Shirts', 'Kids Jeans', 'Ethnic Wear', 'School Shoes']
          : women
            ? ['Kurtis', 'Sarees', 'Suits', 'Western Dresses', 'Tops', 'Jeans', 'Dupatta', 'Lehenga']
            : ['Casual Shirts', 'Formal Shirts', 'T-Shirts', 'Polo T-Shirts', 'Jackets', 'Hoodies', 'Kurtas'],
    ),
    filters: footwear ? footwearFilters : kids ? kidsFilters : clothingFilters,
    sizeGuideType: getSizeGuideType(context),
  };
}

export function getDefaultSizes(sizeGuideType: SizeGuideType) {
  if (sizeGuideType === 'shoes') return ['UK 6', 'UK 7', 'UK 8', 'UK 9'];
  if (sizeGuideType === 'kids') return ['2-3Y', '4-5Y', '6-7Y'];
  if (sizeGuideType === 'saree') return ['Free Size'];
  if (sizeGuideType === 'jeans-trouser') return ['30', '32', '34', '36'];
  return ['S', 'M', 'L', 'XL'];
}

export function getSizeGuideLabel(sizeGuideType: SizeGuideType) {
  const labels: Record<SizeGuideType, string> = {
    'mens-shirt': 'Shirt size guide',
    'mens-tshirt': 'T-shirt size guide',
    'jeans-trouser': 'Jeans/trouser size guide',
    kurti: 'Kurti size guide',
    saree: 'Saree free size note',
    shoes: 'Shoes size guide',
    kids: 'Kids size guide',
    fashion: 'Fashion size guide',
  };

  return labels[sizeGuideType];
}
