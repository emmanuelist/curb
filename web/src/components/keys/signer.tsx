export type KeyRole = "trading" | "owner";

export function KeyGlyph({ role, size = 16 }: { role: KeyRole; size?: number }) {
  if (role === "owner") {
    // Passkey / Face ID: the owner key only exists after a biometric check.
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
        <path d="M9 9v1.5M15 9v1.5M12 9.5v4h-1M9 16.2c1.8 1.3 4.2 1.3 6 0" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3 20 3M16 7l3 3M13.5 9.5l2 2" />
    </svg>
  );
}

/** Who signs this action, shown before it is taken (BRIEF §10). */
export function Signer({ role, detail }: { role: KeyRole; detail?: string }) {
  const owner = role === "owner";
  return (
    <p className="flex items-center gap-2 text-[12px] text-muted">
      <span className={owner ? "text-kerb" : "text-road"}>
        <KeyGlyph role={role} />
      </span>
      <span>
        <span className={`font-semibold ${owner ? "text-kerb" : "text-road"}`}>{owner ? "Owner key" : "Trading key"}</span>
        {" · "}
        {owner ? "Face ID required" : "no prompt"}
        {detail ? ` · ${detail}` : ""}
      </span>
    </p>
  );
}
