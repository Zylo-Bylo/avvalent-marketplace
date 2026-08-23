import CategoryListingClient from "@/components/category/CategoryListingClient";

export const dynamic = "force-dynamic";

export default async function CategoryPartPage({
  params,
}: {
  params: Promise<{ main: string; sub: string; part: string }>;
}) {
  const { main, sub, part } = await params;

  return (
    <CategoryListingClient
      key={`${main}/${sub}/${part}`}
      mainSlug={main}
      groupSlug={sub}
      partSlug={part}
    />
  );
}
