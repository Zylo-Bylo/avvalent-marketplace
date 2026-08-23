import CategoryListingClient from "@/components/category/CategoryListingClient";

export const dynamic = "force-dynamic";

export default async function CategoryGroupPage({
  params,
}: {
  params: Promise<{ main: string; sub: string }>;
}) {
  const { main, sub } = await params;

  return (
    <CategoryListingClient
      key={`${main}/${sub}`}
      mainSlug={main}
      partSlug={sub}
    />
  );
}
