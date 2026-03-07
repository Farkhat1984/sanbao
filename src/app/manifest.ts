import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sanbao — AI-платформа",
    short_name: "Sanbao",
    description: "AI-платформа для юристов, бухгалтеров и таможенных специалистов Казахстана",
    start_url: "/chat",
    display: "standalone",
    background_color: "#F4EFE6",
    theme_color: "#8FAF9F",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
