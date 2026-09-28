# Plan

Deadline: **2026-10-13 23:59 ET** (Rules & Guidelines v3.0 §4.2; the submission can be edited until then). Internal target: **2026-10-12 23:59 ET**.

| # | Milestone | Exit criteria (a stranger could check these) | Due | Status |
|---|---|---|---|---|
| M0 | Spikes | (1) A fork test shows a contract can deposit, place, cancel and withdraw on Kuru MON-USDC. (2) One passkey yields two distinct keys via Mera PRF in a browser, and one of them signs a tx accepted by a fork. ~~(3) One real mainnet tx signed by a Mera-derived key~~ → moved to M1 (D-010). Bounty texts captured. | 2026-09-28 | (1) ✅ E-001 · (2) ✅ E-002 · device ✅ #3 · bounty texts pending #5 |
| M1 | Walking skeleton | BRIEF phases 1–2 on **real data**: tokens, type, nav, `CurbLane`, Trade screen with Kuru's live MON-USDC book, and a block indicator driven by real new blocks. Onboarding with an in-app-browser guard. Works at 390/430/768/1280/1440. Deployed (public URL). On the user's phone, Face ID creates an account and sends one real mainnet tx. CI green (lint, typecheck, build, forge test). | 2026-10-02 | ✅ 2026-09-28: live E-007/E-012, redesign E-006, phone tx E-013 |
| M2 | Core claim | CurbAccount deployed and verified on mainnet. BRIEF phases 3–5: order entry/preview/lane-lock, Orders (open/filled/cancelled), History, Transaction details, the Refused state, Keys, the owner Face ID sheet, Deposit, Withdraw. The trading key places and cancels real orders on MON-USDC with no prompt. **Refusals shown onchain:** trading-key withdrawal reverts; off-book order reverts. Owner withdrawal with Face ID succeeds. | 2026-10-08 | — |
| M3 | Proof surface | BRIEF phases 7–11 (mobile refinement, motion, accessibility, performance, final visual audit). README proof section (rules §4.1: setup, architecture, stack, Monad explanation, addresses, AI disclosure). Every claim has an EVIDENCE entry. Measured order-to-confirmation latency. Demo video ≤ 3:00, public (real footage → Remotion → ElevenLabs, D-007). | 2026-10-11 | — |
| M4 | Submitted | Submitted on hackathon.monad.xyz in Track 1 with the verbatim thesis. Bounties selected. Preflight passed from a phone on cellular. | 2026-10-12 | — |

## Cut list

Things deliberately not being built. Each entry links the DECISIONS entry that cut it.

- Native iOS/Android app (D-002)
- Market creation on Kuru (gated on mainnet; not needed for the thesis) (D-001)
- Mock data layer, wagmi (D-011)
- Notifications, appearance/currency settings, market selector, price chart (D-011)
