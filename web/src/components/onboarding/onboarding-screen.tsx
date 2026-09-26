"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { KeyGlyph } from "@/components/keys/signer";
import { CopyAddress } from "@/components/keys/copy-address";
import { createAccount, signIn, type KeyRole } from "@/lib/passkey/keys";
import { detectPasskeyEnvironment, explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import { saveAccount } from "@/lib/passkey/store";
import { useAccount } from "@/hooks/use-account";

const noop = () => () => {};
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

type Phase = { kind: "idle" } | { kind: "working"; mode: "create" | "sign-in"; stage: KeyRole } | { kind: "error"; problem: PasskeyProblem };

/** Onboarding: one passkey, two keys (D-011 amendment 4). Guards run before any ceremony. */
export function OnboardingScreen() {
  const isClient = useIsClient();
  const account = useAccount();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  if (!isClient) return <Shell />;

  const env = detectPasskeyEnvironment(navigator.userAgent, typeof window.PublicKeyCredential === "function");
  if (env.kind === "in-app") return <OpenInBrowser app={env.app} />;
  if (env.kind === "unsupported")
    return (
      <Shell>
        <Problem problem={{ title: "This browser can't use passkeys.", body: "Open Curb in a current version of Safari, Chrome, Firefox or Edge." }} />
      </Shell>
    );

  if (account && phase.kind !== "working") {
    return (
      <Shell>
        <p className="text-[12px] font-semibold tracking-[0.14em] text-muted">YOUR CURB ACCOUNT</p>
        <h1 className="mt-2 font-display text-[44px] font-extrabold leading-none [font-variation-settings:'wdth'_62] md:text-[60px]">Two keys, ready.</h1>
        <KeyRows owner={account.owner} trading={account.trading} />
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/keys" className="inline-flex h-14 items-center justify-center rounded-[2px] bg-road font-display text-[18px] font-extrabold tracking-[0.05em] text-asphalt [font-variation-settings:'wdth'_75]">
            GO TO KEYS
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center justify-center text-[13px] text-muted underline decoration-faint underline-offset-4">
            Back to the lane
          </Link>
        </div>
      </Shell>
    );
  }

  const run = async (mode: "create" | "sign-in") => {
    const rpId = window.location.hostname;
    try {
      const onStage = (stage: KeyRole) => setPhase({ kind: "working", mode, stage });
      const record = mode === "create" ? await createAccount(rpId, onStage) : await signIn(rpId, onStage);
      saveAccount(record);
      setPhase({ kind: "idle" });
    } catch (error) {
      setPhase({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  const working = phase.kind === "working" ? phase : null;

  return (
    <Shell>
      <p className="text-[12px] font-semibold tracking-[0.14em] text-muted">NEW ACCOUNT</p>
      <h1 className="mt-2 font-display text-[48px] font-extrabold leading-[0.92] [font-variation-settings:'wdth'_62] md:text-[68px]">
        One passkey.
        <br />
        Two keys.
      </h1>
      <p className="mt-4 max-w-[46ch] text-[14px] leading-relaxed text-muted">
        No seed phrase, no wallet app. Your passkey makes both keys on this device each time you need them. Neither is stored.
      </p>

      <dl className="mt-8 flex flex-col gap-4">
        <RoleRow role="owner" active={working?.stage === "owner"} step={working ? (working.mode === "create" ? 1 : 2) : undefined}>
          The only key that moves money out. Made with Face ID every time, then destroyed.
        </RoleRow>
        <RoleRow role="trading" active={working?.stage === "trading"} step={working ? (working.mode === "create" ? 2 : 1) : undefined}>
          Places and cancels orders inside the lane, without a prompt. Can&apos;t withdraw.
        </RoleRow>
      </dl>

      <div aria-live="polite" className="mt-6 min-h-6">
        {working ? (
          <p className="figures text-[12px] text-road">
            FACE ID {working.mode === "create" ? (working.stage === "owner" ? 1 : 2) : working.stage === "trading" ? 1 : 2} OF 2 ·{" "}
            {working.stage === "owner" ? "OWNER KEY" : "TRADING KEY"}
          </p>
        ) : phase.kind === "error" ? (
          <Problem problem={phase.problem} />
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          disabled={Boolean(working)}
          onClick={() => run("create")}
          className="flex h-14 items-center justify-center gap-2.5 rounded-[2px] bg-kerb font-display text-[18px] font-extrabold tracking-[0.05em] text-asphalt [font-variation-settings:'wdth'_75] disabled:opacity-50"
        >
          <KeyGlyph role="owner" size={22} />
          CREATE WITH A PASSKEY
        </button>
        <button
          type="button"
          disabled={Boolean(working)}
          onClick={() => run("sign-in")}
          className="inline-flex min-h-11 items-center justify-center text-[13px] text-road underline decoration-faint underline-offset-4 disabled:opacity-50"
        >
          I already have a Curb passkey
        </button>
      </div>
      <p className="mt-6 text-[12px] leading-relaxed text-muted">
        You&apos;ll see Face ID (or your device PIN) twice: once for each key.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-[560px] px-5 pb-28 pt-4 md:pt-14">{children}</main>;
}

function RoleRow({ role, active, step, children }: { role: KeyRole; active?: boolean; step?: number; children: React.ReactNode }) {
  const owner = role === "owner";
  return (
    <div className={`grid grid-cols-[6px_minmax(0,1fr)] gap-x-3.5 ${active === false && step ? "opacity-50" : ""}`}>
      <span className={`row-span-2 ${owner ? "bg-kerb" : "bg-road"}`} aria-hidden="true" />
      <dt className={`flex items-center gap-2 text-[12px] font-semibold tracking-[0.12em] ${owner ? "text-kerb" : "text-road"}`}>
        {owner ? "OWNER KEY" : "TRADING KEY"}
        {active ? <span className="figures text-[10px] font-normal tracking-normal text-muted">· waiting for Face ID</span> : null}
      </dt>
      <dd className="mt-0.5 text-[13px] leading-snug text-muted">{children}</dd>
    </div>
  );
}

function KeyRows({ owner, trading }: { owner: string; trading: string }) {
  return (
    <dl className="mt-8 flex flex-col gap-5">
      <RoleRow role="owner">
        <CopyAddress address={owner} tone="owner" />
      </RoleRow>
      <RoleRow role="trading">
        <CopyAddress address={trading} tone="trading" />
      </RoleRow>
    </dl>
  );
}

function Problem({ problem }: { problem: PasskeyProblem }) {
  return (
    <div role="alert" className="border-l-[3px] border-road pl-3">
      <p className="text-[14px] font-semibold">{problem.title}</p>
      <p className="mt-1 text-[13px] leading-snug text-muted">{problem.body}</p>
    </div>
  );
}

function OpenInBrowser({ app }: { app: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Shell>
      <div className="hatch -mx-5 px-5 py-6 md:mx-0">
        <p className="inline bg-asphalt px-2 font-stencil text-[40px] font-black leading-none tracking-[0.04em] [font-variation-settings:'opsz'_72]">
          OPEN IN SAFARI
        </p>
      </div>
      <h1 className="mt-6 text-[20px] font-semibold">Passkeys don&apos;t work inside {app}.</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        In-app browsers can&apos;t create passkeys for other sites. Open this page in Safari or Chrome to create your Curb
        account. On iPhone, tap the ••• or share button and choose Open in Safari.
      </p>
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
        className="mt-6 inline-flex h-12 items-center rounded-[2px] border-[1.5px] border-road px-5 font-display text-[15px] font-extrabold tracking-[0.06em] [font-variation-settings:'wdth'_75]"
      >
        {copied ? "LINK COPIED" : "COPY LINK"}
      </button>
    </Shell>
  );
}
