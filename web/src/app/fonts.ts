import { Archivo, Martian_Mono } from "next/font/google";
import localFont from "next/font/local";

/** Prices and big numbers. The width axis is the point: compressed, engineered figures (BRIEF §5). */
export const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

/** Addresses, hashes, block numbers, order-book figures. */
// Not preloaded: addresses and hashes appear on Keys only, so the home page never pays for it up front.
export const martian = Martian_Mono({ subsets: ["latin"], axes: ["wdth"], variable: "--font-martian", display: "swap", preload: false });

/** The board's street lettering: the hero price (700, measured against the approved comp) and signage (800). Big Shoulders Stencil (OFL), latin, served locally. */
export const stencil = localFont({
  src: [
    { path: "./fonts/big-shoulders-stencil-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/big-shoulders-stencil-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-stencil-face",
  display: "swap",
});

/**
 * Big Shoulders (the stencil's own non-stencil cut), for one glyph only: the stencil "4" leaves its crossbar tip as a
 * detached square that reads as a second decimal point inside a price. Limited to U+0034 and placed ahead of the
 * stencil in `--font-stencil`, it draws every stencil 4 on the site and nothing else. Big Shoulders (OFL), served locally.
 */
export const shoulders = localFont({
  src: [{ path: "./fonts/big-shoulders-700.woff2", weight: "700", style: "normal" }],
  variable: "--font-shoulders",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0034" }],
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
