# State

_Last verified: 2026-10-04, branch `44-latency-evidence`; repo: https://github.com/emmanuelist/curb (public); live: https://curb-jet.vercel.app_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M2 done 2026-10-03 (E-019); now M3 · Proof surface (due 2026-10-11) · **Deadline:** 2026-10-13 23:59 ET · 9 days left
**Next action:** the recording session for the videos (#45, #52; run of show in `internal/demo/`). It needs the user's yes on about 200 MON for the Kuru beats and a voice choice (ElevenLabs key or their own voice). The trading key holds about 0.13 MON after the latency run, so it needs gas for the recording too. #43 waits only on the video link. After submission, return the demo funds (#61).
**Blocked on:** Agora's answer on whether a mobile web app counts (#52).

## Works

| Capability | Verified by | Evidence |
|---|---|---|
| **Agora's flow on mainnet from the user's iPhone (#51, #56):** passkey → create the v2 account → Get 354.08 MON → 11.86 AUSD through Kuru Flow → onto Perpl → long 300 MON at 2× → 10× refused onchain (`LeverageAboveCap`) → a bid past the curb refused onchain (`PerpOffLane`) → closed | 8 txs found by nonce and decoded with traces; account source exact match | E-028 (2026-10-04) |
| **Demand evidence (#46):** docs/DEMAND.md, with Binance's trade-only key permissions, HAPI's account of the 3Commas drain ($27.3M with trade-only keys) and a mainnet sample showing most Kuru and Perpl order flow signed by gas-only keys for contracts that hold the funds | public sources; `web/scripts/order-flow-sample.mjs` | E-037 (2026-10-04) |
| **README as a proof surface (#43):** eight mainnet transactions (four onchain refusals) with their status read onchain, addresses, how it works, limits | all 25 links checked | PR #71 (2026-10-04) |
| **Order latency on mainnet (#44):** tap to receipt from the user's iPhone, median 1.4 s, p90 1.8 s over 17 trading-key transactions (orders median 1.55 s); a close refused when the bid moved led to D-033 (close 0.10% inside the curb), and the next close went through | screenshots matched to transactions by nonce | E-038 (2026-10-04) |
| **Polish pass (#47):** every screen at 390 and 1280, two finish-review rounds (8 fixes resolved, 1 regression fixed). Venue rejections no longer wear the account's red (D-032); production Lighthouse: phone Trade 91–92 / 100 / 100 / 100, desktop 85–86 from here (99 locally, network-bound) | fork + Playwright; impeccable detect []; Lighthouse 12.8.2 | E-035, E-036 (2026-10-04) |
| **The trading session's scope and expiry, stated and enforced (#42, D-031):** the unlock step says what the key can't do; every ticket state and Orders show the time left and Lock; 15 minutes unused locks every screen cleanly, and a key past its deadline can't sign even when the timer was held back | fork + Playwright (virtual passkey, ceremony counter, fake clock) + `cast nonce`; 5 unit tests | E-034 (2026-10-04) |
| **One Face ID makes both keys (#41, D-030):** creating takes 1 ceremony and signing in 1; owner actions still prompt alone. Landing to first transaction: 4 taps, 2 Face IDs | Playwright ceremony counter; fork; one Face ID to sign in on the user's iPhone | E-032, E-033 (2026-10-04) |
| **Orders and History rebuild from the chain alone (#40, D-029):** a fresh profile read the user's 8 mainnet transactions and the long's fill in about 20 s; a wiped device rebuilt an open order and cancelled it | Playwright on mainnet (read-only) and on a fork; the user's iPhone in a Private tab, 12.9 s | E-030, E-031 (2026-10-04) |
| A one-tap close walks a thin book inside the lane with a measured gas limit (D-028): 300 MON closed across two levels when the top held 10 | fork + Playwright + virtual passkey | E-029 (2026-10-04) |
| Kuru Flow picks the route; Monad prices it (D-027): Kuru's estimates ran about 1% above what routes paid | read-only `eth_call` and `estimateGas` from the owner key | E-027 (2026-10-04) |
| Fund futures from MON inside Curb (#56), on a fork | fresh mainnet fork + Playwright + virtual passkey | E-026 (2026-10-04) |
| Production trades through factory v2 | Playwright on production | E-025 (2026-10-04) |
| CurbFactory v2 live and verified on mainnet (#50) | deploy tx + Sourcify exact match + reads | E-024 (2026-10-04) |
| Futures in the app on a fork (#51): market switch, Perpl lane, cap drawn as a curb (D-024), position card, Orders and History with Perpl orders, cancels and fills (D-025) | anvil + Playwright + virtual passkey; finish review "ship" | E-022, E-023 (2026-10-03/04) |
| CurbAccount v2 holds the trading key to Perpl's live book and a leverage cap (D-021) | 39/39 fork tests under Monad rules; the Perpl tests now walk the book | E-020, E-021; rerun 2026-10-04 |
| **M2 exit on mainnet, from the user's iPhone (v1 account, Kuru):** create, fund, `NotOwner` and `OffLane` refused onchain, a real 200 MON sell placed and cancelled, owner withdrew | txs found by nonce, decoded with traces | E-019 (2026-10-03) |
| Refusal moment, proofs, owner withdraw and send; create, deposit, place, cancel, fills, Orders and History from the device ledger (D-018, D-019) | anvil + Playwright + virtual passkey | E-017, E-018 |
| M1: real passkey on the user's iPhone; owner key signs a real mainnet tx with Face ID | tx 0x72c21e7e…4a9ab4 | E-013 (2026-09-28) |
| Board redesign and identity | Playwright, Lighthouse | E-006 to E-011 (2026-09-27) |
| Gate: web lint 0 warnings, typecheck, 80 tests, warning-free build; `impeccable detect` [] (E-035); contracts 39/39, `forge lint` 0 (E-030) | local and CI | E-030, E-035 (2026-10-04) |

## Deployed

| What | Network | Address / URL | Last checked |
|---|---|---|---|
| **CurbFactory v2** (the app's factory) | Monad mainnet | `0xC3b37bfa0c4496005F01a9E92cD5d285398db000` (verified, exact match) | 2026-10-04 (E-024) |
| **The user's v2 CurbAccount** | Monad mainnet | `0x59C87e37a9bb219C517f01fd6cB3AdB5Cb7aFDB1` (verified, exact match); Perpl account #5,395 holds 11.847505 AUSD, no position | 2026-10-04 (E-028) |
| CurbFactory v1 (Kuru only; the app no longer uses it) | Monad mainnet | `0x633Bf378031d694Bcb8E39E6CF160efD75Af18e8` (verified) | 2026-09-28 (E-016) |
| The user's v1 CurbAccount | Monad mainnet | `0xf774a7013e1A0325830d5B4D9D45980cc30231BB` (verified; holds nothing) | 2026-10-04 (E-024) |
| Web app (Vercel project `curb`, root `web/`), from GitHub on merge to `main` (D-016); no Vercel env vars | Monad mainnet | https://curb-jet.vercel.app (D-014) | 2026-10-04 (E-025) |

Read on mainnet 2026-10-04 after the run: the owner key holds 10.39 MON (Monad's 10 MON reserve plus gas) and the trading key 0.80 MON.

## Broken or unverified

- Creating a new passkey on iOS in one Face ID (PRF at creation) is unverified; sign-in on iOS is one Face ID (E-033).
- Get depends on Kuru Flow's API for the route (one quote a second); AUSD can still arrive from outside (D-026, D-027).
- A v1 account no longer shows in the app; the user's holds nothing.
- Kuru deposits are MON only; USDC deposit deferred (D-018).
- No separate order preview, transaction details screen or custom owner sheet (D-020).
- A first read on a new device takes about 20 s on the public RPC. Fills of an order that filled in parts are found only for its last part (D-029). A Perpl fill seen only after its id was reused could be credited to the newer order (D-025).
- The Impeccable hero gate stays formally open at 81% (colours the user waived, D-013).

## Open questions

- Does Agora accept a mobile web app as "a mobile application"? (#52; asked in Discord)
