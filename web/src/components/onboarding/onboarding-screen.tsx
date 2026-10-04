"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Check, Copy, Menu } from "lucide-react";
import { Wordmark } from "@/components/curb/wordmark";
import { KeyGlyph } from "@/components/keys/signer";
import { CopyAddress } from "@/components/keys/copy-address";
import type { KeyRole, KeyStage } from "@/lib/passkey/keys";
import { usePasskeyKeys } from "@/hooks/use-passkey-keys";
import { detectPasskeyEnvironment, explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import { saveAccount } from "@/lib/passkey/store";
import { useAccount } from "@/hooks/use-account";

const noop = () => () => {};
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

type Phase = { kind: "idle" } | { kind: "working"; mode: "create" | "sign-in"; stage: KeyStage } | { kind: "error"; problem: PasskeyProblem };

/** Onboarding: one passkey, two keys (D-011 amendment 4). Guards run before any ceremony. */
export function OnboardingScreen() {
  const isClient = useIsClient();
  const account = useAccount();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Loaded when this screen opens; the passkey buttons wait for it, so a tap goes straight to Face ID.
  const keys = usePasskeyKeys();

  if (!isClient) return <Shell title={<>One passkey.<br />Two keys.</>} />;

  const env = detectPasskeyEnvironment(navigator.userAgent, typeof window.PublicKeyCredential === "function");
  if (env.kind === "in-app") return <OpenInBrowser app={env.app} />;
  if (env.kind === "unsupported")
    return (
      <Shell title={<>Passkeys<br />unavailable.</>}>
        <Problem problem={{ title: "This browser can't use passkeys.", body: "Open Curb in a current version of Safari, Chrome, Firefox or Edge." }} />
      </Shell>
    );

  if (account && phase.kind !== "working") {
    return (
      <Shell title={<>Two keys,<br />ready.</>} lede="Both keys come from your passkey. Nothing secret is stored on this device.">
        <div className="flex flex-col gap-3">
          <StepCard role="owner" state="done" i={1}>
            <CopyAddress address={account.owner} />
          </StepCard>
          <StepCard role="trading" state="done" i={2}>
            <CopyAddress address={account.trading} />
          </StepCard>
        </div>
        <div className="rise mt-6 flex flex-col gap-2.5" style={{ "--i": 3 } as CSSProperties}>
          <Link href="/keys" className="btn btn-primary">
            Go to Keys <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
          </Link>
          <Link href="/" className="btn btn-quiet">
            Back to the lane
          </Link>
        </div>
      </Shell>
    );
  }

  const run = async (mode: "create" | "sign-in") => {
    if (!keys) return;
    const rpId = window.location.hostname;
    try {
      const onStage = (stage: KeyStage) => setPhase({ kind: "working", mode, stage });
      const record = mode === "create" ? await keys.createAccount(rpId, onStage) : await keys.signIn(rpId, onStage);
      saveAccount(record);
      setPhase({ kind: "idle" });
    } catch (error) {
      setPhase({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  const working = phase.kind === "working" ? phase : null;

  // One Face ID makes both keys (#41). A device that can't evaluate two PRF inputs at once asks again for the second.
  const stateOf = (role: KeyRole): StepState => {
    if (!working) return "idle";
    if (working.stage === "both" || working.stage === role) return "active";
    return "done";
  };

  return (
    <Shell title={<>One passkey.<br />Two keys.</>} lede="No seed phrase, no wallet app. Your passkey makes both keys on this device each time you need them. Neither is stored.">
      <ol className="flex flex-col gap-3">
        <StepCard role="owner" state={stateOf("owner")} step={1} i={1}>
          The only key that moves money out. Made with Face ID every time, then gone.
        </StepCard>
        <StepCard role="trading" state={stateOf("trading")} step={2} i={2}>
          Places and cancels orders inside the lane, without a prompt. It can&apos;t withdraw.
        </StepCard>
      </ol>

      <div aria-live="polite" className="mt-4 empty:hidden">
        {working ? (
          <p className="pill h-8 px-3 text-road">
            <span className="block-pulse size-1.5 rounded-full bg-kerb [--pulse:var(--owner-key)]" aria-hidden="true" />
            {working.stage === "both" ? "Face ID · makes both keys" : `Face ID once more · ${working.stage === "owner" ? "owner key" : "trading key"}`}
          </p>
        ) : phase.kind === "error" ? (
          <Problem problem={phase.problem} />
        ) : null}
      </div>

      <div className="rise mt-6 flex flex-col gap-2.5" style={{ "--i": 3 } as CSSProperties}>
        <button type="button" disabled={Boolean(working) || !keys} onClick={() => run("create")} className="btn btn-owner">
          <KeyGlyph role="owner" size={20} />
          {working?.mode === "create" ? "Waiting for Face ID…" : "Create with a passkey"}
        </button>
        <button type="button" disabled={Boolean(working) || !keys} onClick={() => run("sign-in")} className="btn btn-quiet">
          {working?.mode === "sign-in" ? "Waiting for Face ID…" : "I already have a Curb passkey"}
        </button>
      </div>
      <p className="rise mt-4 text-center text-[12px] leading-relaxed text-muted" style={{ "--i": 4 } as CSSProperties}>
        One Face ID (or your device PIN) makes both keys. A few devices ask a second time.
      </p>
    </Shell>
  );
}

function Shell({ title, lede, children }: { title?: ReactNode; lede?: string; children?: ReactNode }) {
  return (
    <main className="mx-auto grid w-full max-w-[1100px] pb-32 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8 md:px-8 md:pb-16 md:pt-10">
      <section aria-label="Curb" className="relative isolate flex min-h-[300px] flex-col justify-between overflow-hidden px-[22px] pb-7 pt-6 md:min-h-[620px] md:rounded-[16px] md:border md:border-rule md:shadow-[var(--shadow-panel)] md:p-8">
        <Image src="/plates/curb-photo.png" alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 768px) 50vw, 100vw" className="pointer-events-none -z-10 object-cover object-[70%_100%]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(11_13_15/0.55)_0%,rgb(11_13_15/0.15)_40%,rgb(11_13_15/0.95)_100%)]" aria-hidden="true" />
        <div className="flex items-center justify-between md:hidden">
          <Wordmark />
          <Link href="/more" aria-label="Menu" className="-mr-2.5 grid size-[44px] place-items-center rounded-[12px] text-road transition-colors hover:bg-high/70">
            <Menu size={24} strokeWidth={2.4} />
          </Link>
        </div>
        <p className="hidden items-center gap-2 text-[13px] text-muted md:flex">
          <span className="size-2 rounded-full bg-road" aria-hidden="true" /> Monad mainnet · Kuru
        </p>
        {title ? (
          <div className="rise relative mt-24 md:mt-0">
            {/* A scrim local to the text: the headline and lede never sit on the bright painted kerb. */}
            <div
              className="pointer-events-none absolute -inset-x-10 -inset-y-10 -z-10 bg-[radial-gradient(ellipse_at_30%_60%,rgb(11_13_15/0.88)_0%,rgb(11_13_15/0.6)_45%,transparent_75%)]"
              aria-hidden="true"
            />
            <h1 className="font-display text-[46px] font-extrabold leading-[0.92] tracking-[-0.01em] text-road [font-variation-settings:'wdth'_70] md:text-[72px]">{title}</h1>
            {lede ? <p className="mt-3 max-w-[40ch] text-[14px] leading-relaxed text-muted md:text-[15px]">{lede}</p> : null}
          </div>
        ) : null}
      </section>
      <div className="px-4 pt-5 md:flex md:flex-col md:justify-center md:px-0 md:pt-0">{children}</div>
    </main>
  );
}

type StepState = "idle" | "active" | "waiting" | "done";

function StepCard({ role, state, step, i, children }: { role: KeyRole; state: StepState; step?: number; i: number; children: ReactNode }) {
  const owner = role === "owner";
  const active = state === "active";
  return (
    <li
      style={{ "--i": i } as CSSProperties}
      aria-current={active ? "step" : undefined}
      className={`panel rise flex list-none gap-4 p-4 transition-[border-color,opacity] duration-300 ${active ? (owner ? "border-kerb/70" : "border-road/70") : ""} ${state === "waiting" ? "opacity-50" : ""}`}
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-full border ${owner ? "border-kerb/50 bg-kerb/10 text-kerb" : "border-rule-strong bg-high text-road"} ${active ? (owner ? "block-pulse [--pulse:var(--owner-key)]" : "block-pulse") : ""}`}
      >
        {state === "done" ? <Check size={19} strokeWidth={2.4} aria-hidden="true" /> : <KeyGlyph role={role} size={20} />}
      </span>
      <div className="min-w-0 grow">
        <p className="flex items-center justify-between gap-2">
          <span className={`text-[16px] font-semibold ${owner ? "text-kerb" : "text-road"}`}>{owner ? "Owner key" : "Trading key"}</span>
          <span className="text-[12px] text-muted">
            {state === "done" ? "Ready" : active ? "Waiting for Face ID" : step ? "Made by your passkey" : null}
          </span>
        </p>
        <div className="mt-1 text-[13px] leading-relaxed text-muted">{children}</div>
      </div>
    </li>
  );
}

function Problem({ problem }: { problem: PasskeyProblem }) {
  return (
    <div role="alert" className="rounded-[12px] border border-rule-strong bg-high px-4 py-3">
      <p className="text-[14px] font-semibold text-road">{problem.title}</p>
      <p className="mt-1 text-[13px] leading-snug text-muted">{problem.body}</p>
    </div>
  );
}

function OpenInBrowser({ app }: { app: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Shell title={<>Open in<br />Safari.</>} lede={`Passkeys don't work inside ${app}.`}>
      <div className="panel rise p-5" style={{ "--i": 1 } as CSSProperties}>
        <p className="text-[14px] leading-relaxed text-muted">
          In-app browsers can&apos;t create passkeys for other sites. Open this page in Safari or Chrome to create your Curb account. On iPhone, tap the ••• or
          share button and choose <span className="text-road">Open in Safari</span>.
        </p>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className="btn btn-primary rise mt-4 w-full"
        style={{ "--i": 2 } as CSSProperties}
      >
        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        {copied ? "Link copied" : "Copy link"}
      </button>
    </Shell>
  );
}
