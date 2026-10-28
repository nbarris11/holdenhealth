import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Holden Health",
    short_name: "Holden Health",
    description: "Your workouts, programs, and conversations with Kelsey.",
    start_url: "/portal/today",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#143b34",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
