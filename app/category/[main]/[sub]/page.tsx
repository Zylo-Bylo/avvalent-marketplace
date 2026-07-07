import CategoryListingClient from "@/components/category/CategoryListingClient";

export default async function CategoryGroupPage({
  params,
}: {
  params: Promise<{ main: string; sub: string }>;
}) {
  const { main, sub } = await params;

  return <CategoryListingClient mainSlug={main} partSlug={sub} />;
}
