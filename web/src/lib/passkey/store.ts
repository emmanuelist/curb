import type { CurbAccountRecord } from "@/lib/passkey/keys";

const KEY = "curb.account.v1";

/** The account record holds public data only: credential id, transports, two addresses. Never a key. */
export function loadAccount(): CurbAccountRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CurbAccountRecord;
    return parsed?.credential?.credentialId && parsed.owner && parsed.trading ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAccount(record: CurbAccountRecord) {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
    window.dispatchEvent(new Event("curb-account"));
  } catch {
    // Private mode or blocked storage: the account still works for this session.
  }
}

export function forgetAccount() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("curb-account"));
  } catch {
    // Nothing stored.
  }
}

export function subscribeAccount(onChange: () => void) {
  window.addEventListener("curb-account", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("curb-account", onChange);
    window.removeEventListener("storage", onChange);
  };
}
