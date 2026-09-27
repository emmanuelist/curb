import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge would land inside measured screenshots of the tab bar.
  devIndicators: false,
  images: {
    // AVIF where the browser takes it (about 20% smaller than WebP for the curb photo), WebP otherwise.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Tailwind's CSS is small and atomic: inline it so first paint doesn't wait on a stylesheet request.
    inlineCss: true,
  },
};

export default nextConfig;
