import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",

    name: "NKRN School Operations",
    short_name: "NKRN",

    description:
      "Secure school operations management for IT support, logistics and administration.",

    start_url: "/",
    scope: "/",

    display: "standalone",
    orientation: "any",

    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",

    categories: [
      "education",
      "productivity",
      "business",
    ],

    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}