import { Archivo, Martian_Mono } from "next/font/google";
import localFont from "next/font/local";

/** Prices and big numbers. The width axis is the point: compressed, engineered figures (BRIEF §5). */
export const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

/** Addresses, hashes, block numbers, order-book figures. */
export const martian = Martian_Mono({ subsets: ["latin"], axes: ["wdth"], variable: "--font-martian", display: "swap" });

/** Signage only: NO WITHDRAWAL, LOADING ZONE, OFF-BOOK, REFUSED. Big Shoulders Stencil (OFL), latin 800/900, served locally. */
export const stencil = localFont({
  src: [
    { path: "./fonts/big-shoulders-stencil-800.woff2", weight: "800", style: "normal" },
    { path: "./fonts/big-shoulders-stencil-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-stencil-face",
  display: "swap",
});

/** Interface and body, used quietly. Switzer by Indian Type Foundry via Fontshare (ITF Free Font License). */
export const switzer = localFont({
  src: [
    { path: "./fonts/switzer-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/switzer-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/switzer-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-switzer",
  display: "swap",
});
