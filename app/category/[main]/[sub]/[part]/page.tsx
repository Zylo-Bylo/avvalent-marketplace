import CategoryListingClient from "@/components/category/CategoryListingClient";

export default async function CategoryPartPage({
  params,
}: {
  params: Promise<{ main: string; sub: string; part: string }>;
}) {
  const { main, sub, part } = await params;

  return <CategoryListingClient mainSlug={main} groupSlug={sub} partSlug={part} />;
}
