"use client";

import { useEffect, useState } from "react";
import { loadPasskeyKeys, passkeyKeysNow, type KeysModule } from "@/lib/passkey/lazy";

/** The passkey key module, or null while it loads. Buttons that start a Face ID prompt stay disabled until it's here. */
export function usePasskeyKeys(): KeysModule | null {
  const [keys, setKeys] = useState<KeysModule | null>(passkeyKeysNow);
  useEffect(() => {
    if (keys) return;
    let live = true;
    void loadPasskeyKeys().then((m) => {
      if (live) setKeys(m);
    });
    return () => {
      live = false;
    };
  }, [keys]);
  return keys;
}
