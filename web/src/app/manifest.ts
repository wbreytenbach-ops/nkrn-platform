import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",

    name: "Tygies 1 | Laerskool Tygerpoort",
    short_name: "Tygies 1",

    description:
      "Tygies 1 se veilige skoolbedryfsportaal vir IT-ondersteuning, logistiek, funksieversorging en administrasie.",

    start_url: "/",
    scope: "/",

    display: "standalone",
    orientation: "any",

    background_color: "#18181b",
    theme_color: "#B91C2B",

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