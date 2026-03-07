import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/offer", "/privacy", "/terms"],
        disallow: [
          "/api/",
          "/admin/",
          "/chat/",
          "/settings",
          "/profile",
          "/agents/",
          "/skills/",
          "/organizations/",
          "/mcp",
          "/billing",
          "/invite/",
        ],
      },
    ],
    sitemap: "https://sanbao.ai/sitemap.xml",
  };
}
