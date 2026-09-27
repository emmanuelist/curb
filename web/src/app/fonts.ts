import { Archivo, Martian_Mono } from "next/font/google";
import localFont from "next/font/local";

/** Prices and big numbers. The width axis is the point: compressed, engineered figures (BRIEF §5). */
export const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

/** Addresses, hashes, block numbers, order-book figures. */
export const martian = Martian_Mono({ subsets: ["latin"], axes: ["wdth"], variable: "--font-martian", display: "swap" });

/** The board's street lettering: the hero price (700, measured against the approved comp) and signage (800/900). Big Shoulders Stencil (OFL), latin, served locally. */
export const stencil = localFont({
  src: [
    { path: "./fonts/big-shoulders-stencil-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/big-shoulders-stencil-800.woff2", weight: "800", style: "normal" },
    { path: "./fonts/big-shoulders-stencil-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-stencil-face",
  display: "swap",
});

/**
 * Big Shoulders (the stencil's own non-stencil cut), for one glyph: the stencil "4" leaves its crossbar tip as a detached
 * square that reads as a second decimal point inside a price, so stencil figures render "4" from this face instead.
 * Big Shoulders (OFL), latin, served locally.
 */
export const shoulders = localFont({
  src: [{ path: "./fonts/big-shoulders-700.woff2", weight: "700", style: "normal" }],
  variable: "--font-shoulders",
  display: "swap",
  // It only ever draws one glyph inside an already-sized stencil line, so no fallback metrics are needed.
  adjustFontFallback: false,
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
