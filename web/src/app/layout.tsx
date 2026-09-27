import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { archivo, martian, shoulders, stencil, switzer } from "./fonts";
import { Providers } from "./providers";
import { DesktopNav, MobileNav } from "@/components/navigation/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curb",
  description: "A trading key that can't withdraw, and can't trade off Kuru's live order book.",
  applicationName: "Curb",
  appleWebApp: { capable: true, title: "Curb", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d0f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${martian.variable} ${stencil.variable} ${shoulders.variable} ${switzer.variable}`}>
      <body className="antialiased">
        <Providers>
          <DesktopNav />
          {children}
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
