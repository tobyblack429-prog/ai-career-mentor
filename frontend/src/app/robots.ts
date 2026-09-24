import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/dashboard/"],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
