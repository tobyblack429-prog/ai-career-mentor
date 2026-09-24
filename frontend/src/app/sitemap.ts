import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

const BASE_URL = getSiteUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...["resume", "roadmap", "market", "linkedin", "interview", "full-analysis"].map((page) => ({
      url: `${BASE_URL}/dashboard/${page}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
