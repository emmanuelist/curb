"use client";

/** The root layout itself failed: no app styles load here, so the page carries its own. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0b0d0f", color: "#ededed", fontFamily: "system-ui, sans-serif" }}>
        <title>Curb</title>
        <main style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Curb stopped loading.</h1>
          <p style={{ color: "#9aa1a8", fontSize: 14, lineHeight: 1.6 }}>A loading error can&apos;t sign or send anything by itself; if you had already confirmed a transaction, it stands onchain as sent.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 12, width: "100%", minHeight: 56, border: 0, borderRadius: 12, background: "#ededed", color: "#0b0d0f", fontSize: 17, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
