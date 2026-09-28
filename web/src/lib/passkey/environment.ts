import { isMeraError } from "@category-labs/mera";

export type PasskeyEnvironment =
  | { kind: "ok" }
  | { kind: "in-app"; app: string }
  | { kind: "unsupported" };

const IN_APP: [RegExp, string][] = [
  [/Telegram/i, "Telegram"],
  [/\bTwitter|TwitterAndroid/i, "X"],
  [/Discord/i, "Discord"],
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB/i, "Facebook"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Line\//i, "LINE"],
  [/MicroMessenger/i, "WeChat"],
  [/Snapchat/i, "Snapchat"],
];

/**
 * In-app browsers break passkeys for other sites. Verified on the user's iPhone: Telegram failed and
 * Safari succeeded on the same page (docs/CONTEXT.md → Traps). Detect before any ceremony.
 */
export function detectPasskeyEnvironment(ua: string, hasWebAuthn: boolean): PasskeyEnvironment {
  for (const [pattern, app] of IN_APP) if (pattern.test(ua)) return { kind: "in-app", app };
  // iOS web views drop the "Safari/" token that Safari and the iOS Chrome/Firefox/Edge shells keep.
  const iOS = /iPhone|iPad|iPod/.test(ua);
  if (iOS && !/Safari\//.test(ua)) return { kind: "in-app", app: "this app" };
  if (/; wv\)/.test(ua)) return { kind: "in-app", app: "this app" };
  if (!hasWebAuthn) return { kind: "unsupported" };
  return { kind: "ok" };
}

export type PasskeyProblem = { title: string; body: string };

/** Mera failures, mapped to what the person can actually do next. */
export function explainPasskeyError(error: unknown): PasskeyProblem {
  if (isMeraError(error)) {
    switch (error.code) {
      case "PRF_UNAVAILABLE":
        return {
          title: "This passkey can't make keys.",
          body: "Your passkey was saved somewhere that doesn't support the PRF extension (for example a Chrome profile, Bitwarden or Dashlane). Use Safari, turn on Google Password Manager in Chrome, use iCloud Keychain or 1Password, or open Curb on your phone.",
        };
      case "PASSKEY_OPERATION_FAILED":
        return {
          title: "The passkey request didn't finish.",
          body: "It was cancelled, timed out, or blocked by this browser. Try again. If you opened this link inside another app, open it in Safari or Chrome instead.",
        };
      case "CRYPTO_UNAVAILABLE":
        return { title: "This browser can't generate keys.", body: "Use a current version of Safari, Chrome, Firefox or Edge." };
      default:
        return { title: "Something went wrong with the passkey.", body: error.message };
    }
  }
  // viem errors carry a one-line `shortMessage`; their full message repeats the request, which helps nobody here.
  const short = typeof error === "object" && error !== null && "shortMessage" in error ? String(error.shortMessage) : null;
  if (short && /insufficient funds/i.test(short)) {
    return { title: "Not enough MON for gas.", body: "The key signing this has too little MON to pay for the transaction. Nothing was sent." };
  }
  return { title: "Something went wrong.", body: short ?? (error instanceof Error ? error.message : String(error)) };
}
