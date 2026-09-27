import type { MetadataRoute } from "next";

/** Installable from the phone's home screen: standalone, asphalt chrome, the kerb-slash mark. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Curb",
    short_name: "Curb",
    description: "A trading key that can't withdraw, and can't trade off Kuru's live order book.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0d0f",
    theme_color: "#0b0d0f",
    categories: ["finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
