import type { MetadataRoute } from "next";
import { applianceCategoryTree, getPartHref } from "@/data/category-tree";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://zylo-buylo.com";

function absoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    "/",
    "/products",
    "/cart",
    "/orders",
    "/login",
    "/signup",
    "/vendor/register",
  ];

  const categoryRoutes = applianceCategoryTree.flatMap((category) =>
    category.groups.flatMap((group) =>
      group.parts.map((part) =>
        getPartHref(category.slug, group.slug, part.slug)
      )
    )
  );

  return [...staticRoutes, ...categoryRoutes].map((route) => ({
    url: absoluteUrl(route),
    lastModified: now,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
