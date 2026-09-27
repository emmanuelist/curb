import type * as Keys from "@/lib/passkey/keys";

export type KeysModule = typeof Keys;

let loaded: KeysModule | null = null;
let pending: Promise<KeysModule> | null = null;

/**
 * Loads the passkey key module (Mera PRF, HD keys, BIP-39, secp256k1) once. It stays out of every other page's bundle,
 * including the route chunks the tab bar prefetches; Start and Keys warm it up when they mount.
 */
export function loadPasskeyKeys(): Promise<KeysModule> {
  pending ??= import("@/lib/passkey/keys").then((m) => (loaded = m));
  return pending;
}

/** The module if already loaded, so a Face ID tap calls straight into it with no network wait in between. */
export function passkeyKeysNow(): KeysModule | null {
  return loaded;
}
