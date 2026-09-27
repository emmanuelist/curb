"use client";

import { useBlockSelector } from "@/hooks/use-live-block";

/**
 * Lane dashes that advance one period per real Monad block, and only then. Each block remounts the dash run, which
 * slides one period on the spring: a transform, so the compositor moves it without repainting the strip.
 */
export function LaneDashes({ className = "" }: { className?: string }) {
  const step = useBlockSelector((s) => s.step);
  const status = useBlockSelector((s) => s.status);
  return (
    <div className={`lane-dashes-live ${className}`} data-status={status} aria-hidden="true">
      <div key={step} className="lane-dashes-run" />
    </div>
  );
}
