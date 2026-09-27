import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "No road here" };

/** A dead end: the lane stops at a curb line. Nothing is signed or sent from here. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-[560px] flex-col justify-center px-4 pb-32 pt-10">
      <section className="panel rise overflow-hidden p-6">
        <p className="font-stencil text-[88px] font-bold leading-[0.9] text-road" aria-hidden="true">
          404
        </p>
        <div className="mt-5 flex items-center gap-2" aria-hidden="true">
          <span className="size-2.5 shrink-0 rounded-full bg-road" />
          <div className="lane-dashes grow opacity-60" />
          <span className="h-7 w-[7px] shrink-0 border-x-2 border-road" />
        </div>
        <h1 className="mt-6 text-[24px] font-semibold text-road">No road here.</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">This address isn&apos;t part of Curb. Nothing was signed and nothing was sent.</p>
        <Link href="/" className="btn btn-primary mt-6 w-full">
          Back to the lane <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
