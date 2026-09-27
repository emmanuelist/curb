"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { Wordmark } from "@/components/curb/wordmark";

/** A screen failed to render. Say what is true: a render error sends nothing, and anything already confirmed stands onchain. */
export default function ErrorScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-[560px] flex-col justify-center px-4 pb-32 pt-10">
      <div className="mb-6 px-1.5 md:hidden">
        <Wordmark />
      </div>
      <section className="panel rise p-6" role="alert">
        {/* The lane runs out into the hollow ring the app uses for "offline": the screen, not the chain, stopped. */}
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="size-2.5 shrink-0 rounded-full bg-road" />
          <div className="lane-dashes grow opacity-60" data-status="stalled" />
          <span className="size-3 shrink-0 rounded-full border-2 border-muted" />
        </div>
        <h1 className="mt-6 text-[24px] font-semibold text-road">This screen stopped.</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
          Drawing it failed. A screen error can&apos;t sign or send anything by itself; if you had already confirmed a transaction, it stands onchain as sent.
        </p>
        {error.digest ? <p className="figures mt-3 text-[11px] text-faint">ref {error.digest}</p> : null}
        <div className="mt-6 flex flex-col gap-2.5">
          <button type="button" onClick={() => retry()} className="btn btn-primary">
            <RotateCw size={18} strokeWidth={2.2} aria-hidden="true" /> Try again
          </button>
          <Link href="/" className="btn btn-quiet">
            Back to the lane
          </Link>
        </div>
      </section>
    </main>
  );
}
