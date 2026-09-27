"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCw } from "lucide-react";

/** A screen failed to render. Say the one thing a trader needs first: nothing left their keys. */
export default function ErrorScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-[560px] flex-col justify-center px-4 pb-32 pt-10">
      <section className="panel rise p-6" role="alert">
        <h1 className="text-[24px] font-semibold text-road">This screen stopped.</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
          Something failed while drawing it. Nothing was signed and nothing was sent; your keys and funds are where they were.
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
