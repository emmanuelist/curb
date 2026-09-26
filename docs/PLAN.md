# Plan

Deadline: **2026-10-13 23:59 ET** (Rules & Guidelines v3.0 §4.2; the submission can be edited until then). Internal target: **2026-10-12 23:59 ET**.

| # | Milestone | Exit criteria (a stranger could check these) | Due | Status |
|---|---|---|---|---|
| M0 | Spikes | (1) A fork test shows a contract can deposit, place, cancel and withdraw on Kuru MON-USDC. (2) One passkey yields two distinct keys via Mera PRF in a browser, and one of them signs a tx accepted by a fork. (3) One real mainnet tx signed by a Mera-derived key. Bounty texts captured. | 2026-09-28 | in progress |
| M1 | Walking skeleton | Deployed web app (public URL). On a phone, Face ID creates an account and sends one real Monad mainnet transaction. CI green (lint, typecheck, build, forge test). | 2026-10-02 | — |
| M2 | Core claim | CurbAccount deployed and verified on mainnet. The trading key places and cancels real orders on MON-USDC with no prompt. **Refusals shown onchain:** trading-key withdrawal reverts; off-book order reverts. Owner withdrawal with Face ID succeeds. | 2026-10-08 | — |
| M3 | Proof surface | README proof section (rules §4.1: setup, architecture, stack, Monad explanation, addresses, AI disclosure). Every claim has an EVIDENCE entry. Measured order-to-confirmation latency. Demo video ≤ 3:00, public (real footage → Remotion → ElevenLabs, D-007). | 2026-10-11 | — |
| M4 | Submitted | Submitted on hackathon.monad.xyz in Track 1 with the verbatim thesis. Bounties selected. Preflight passed from a phone on cellular. | 2026-10-12 | — |

## Cut list

Things deliberately not being built. Each entry links the DECISIONS entry that cut it.

- Native iOS/Android app (D-002)
- Market creation on Kuru (gated on mainnet; not needed for the thesis) (D-001)
