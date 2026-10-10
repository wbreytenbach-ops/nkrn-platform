import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",

    name: "Laerskool Tygerpoort",
    short_name: "Tygerpoort",

    description:
      "Laerskool Tygerpoort se skoolbedryfsportaal vir IT-ondersteuning, logistiek en administrasie.",

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
        src: "/tygie-logo.png",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/tygie-logo.png",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}