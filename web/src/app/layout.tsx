import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { archivo, martian, shoulders, stencil, switzer } from "./fonts";
import { Providers } from "./providers";
import { DesktopNav, MobileNav } from "@/components/navigation/app-nav";
import "./globals.css";

const thesis = "A trading key that can't withdraw, and can't trade off Kuru's live order book.";

export const metadata: Metadata = {
  // The one permanent domain: passkeys bind to it (D-014). Resolves the share images to absolute URLs.
  metadataBase: new URL("https://curb-jet.vercel.app"),
  title: { default: "Curb", template: "%s · Curb" },
  description: thesis,
  applicationName: "Curb",
  appleWebApp: { capable: true, title: "Curb", statusBarStyle: "black-translucent" },
  // Block heights and prices are long digit runs; iOS would otherwise turn them into phone links.
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: { type: "website", siteName: "Curb", title: "Curb", description: thesis, url: "/" },
  twitter: { card: "summary_large_image", title: "Curb", description: thesis },
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
