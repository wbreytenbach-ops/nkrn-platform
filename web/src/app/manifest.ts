import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "NKRN School Operations",
        short_name: "NKRN",
        description:
            "Centralised school operations management for IT, logistics and administration.",

        start_url: "/",
        scope: "/",

        display: "standalone",

        background_color: "#0b0b0d",
        theme_color: "#d7a31f",

        icons: [
            {
                src: "/icon-192x192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/icon-512x512.png",
                sizes: "512x512",
                type: "image/png",
            },
            {
                src: "/icon-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}