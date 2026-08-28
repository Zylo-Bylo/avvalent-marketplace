import HomePageClient from '@/components/home/HomePageClient';
import type { ComponentProps } from 'react';
import {
  defaultHomepageContent,
  normalizeHomepageContent,
} from '@/lib/homepage-content';
import { normalizePublicCategoryTree } from '@/lib/public-category-navigation';

export const dynamic = 'force-dynamic';

type PublicProductsResponse = {
  products?: unknown[];
};

type PublicCategoriesResponse = {
  categories?: unknown[];
};

type HomepageContentResponse = {
  content?: unknown;
};

type HomePageClientProps = ComponentProps<typeof HomePageClient>;

function getBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (configured) {
    return configured.startsWith('http') ? configured : `https://${configured}`;
  }

  return 'http://localhost:3000';
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [productsData, categoriesData, homepageData] = await Promise.all([
    readJson<PublicProductsResponse>('/api/products?limit=24&sort=popular'),
    readJson<PublicCategoriesResponse>('/api/categories?fresh=1'),
    readJson<HomepageContentResponse>('/api/homepage-content'),
  ]);

  return (
    <HomePageClient
      initialProducts={
        (productsData?.products || []) as HomePageClientProps['initialProducts']
      }
      initialCategories={normalizePublicCategoryTree(categoriesData)}
      initialHomepageContent={normalizeHomepageContent(
        homepageData?.content || defaultHomepageContent,
      )}
    />
  );
}
