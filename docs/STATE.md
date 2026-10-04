# State

_Last verified: 2026-10-04, branch `56-fund-ausd`; repo: https://github.com/emmanuelist/curb (public); live: https://curb-jet.vercel.app_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M2 done 2026-10-03 (E-019); now M3 · Proof surface (due 2026-10-11) · **Deadline:** 2026-10-13 23:59 ET · 9 days left
**Next action:** the mainnet run on the user's phone (#51, #56).

1. The user sends about 460 MON from Binance to the owner key `0x222Bc473153617Db03455Ab18C1cab8D6249037C`.
2. In Curb: create the v2 account; Get 450 MON → AUSD; Add it to Perpl; long MON Perp at the cap; prove both refusals; close; withdraw AUSD.

Then #40.
**Blocked on:** MON on the owner key (the user); Agora's answer on whether a mobile web app counts (#52).

## Works

| Capability | Verified by | Evidence |
|---|---|---|
| **Fund futures from MON inside Curb (#56):** Get swaps MON on the owner key for AUSD through Kuru Flow with Face ID, checked before signing (D-026); Add moves it onto Perpl | fresh mainnet fork + Playwright + virtual passkey; unit tests on a real quote | E-026 (2026-10-04) |
| **Production trades through factory v2:** MON Perp in the market menu, lane from Perpl's live mainnet book | Playwright on production after merge `be955cd` | E-025 (2026-10-04) |
| **CurbFactory v2 live and verified on mainnet (#50)** | deploy tx + Sourcify exact match + reads | E-024 (2026-10-04) |
| **Futures in the app, on a fork (#51):** market switch, Perpl lane, long/short under a 5× cap drawn as a curb (D-024), position card, AUSD in and out, both refusals onchain, Orders and History with Perpl orders, cancels and fills (D-025) | anvil + Playwright + virtual passkey; finish review "ship" | E-022, E-023 (2026-10-03/04) |
| CurbAccount v2 holds the trading key to Perpl's live book and a leverage cap (D-021) | 39/39 fork tests under Monad rules | E-020, E-021; rerun 2026-10-04 (E-023) |
| **M2 exit on mainnet, from the user's iPhone (v1 account):** create, fund, `NotOwner` and `OffLane` refused onchain, a real 200 MON sell placed and cancelled, owner withdrew | txs found by nonce, decoded with traces | E-019 (2026-10-03) |
| Refusal moment, proofs, owner withdraw and send, on a fork (D-019) | anvil + Playwright + virtual passkey | E-018 (2026-10-03) |
| Create, deposit, place, cancel, fills, Orders and History from the device ledger, on a fork (D-018) | anvil + Playwright + virtual passkey | E-017 (2026-09-28) |
| M1: real passkey on the user's iPhone; owner key signs a real mainnet tx with Face ID | tx 0x72c21e7e…4a9ab4 | E-013 (2026-09-28) |
| Board redesign, identity, performance (phone Lighthouse 84–99, desktop 99) | Playwright, Lighthouse | E-006 to E-011 (2026-09-27) |
| Gate: web lint 0 warnings, typecheck, 59 tests, warning-free build; contracts 39/39, `forge lint` 0; `impeccable detect` 0 | local | E-026 (2026-10-04); contracts E-023 |

## Deployed

| What | Network | Address / URL | Last checked |
|---|---|---|---|
| **CurbFactory v2** (the app's factory) | Monad mainnet | `0xC3b37bfa0c4496005F01a9E92cD5d285398db000` (verified, exact match) | 2026-10-04 (E-024, E-025) |
| CurbFactory v1 (Kuru only; the app no longer uses it) | Monad mainnet | `0x633Bf378031d694Bcb8E39E6CF160efD75Af18e8` (verified) | 2026-09-28 (E-016) |
| The user's v2 CurbAccount | Monad mainnet | `0x59C87e37a9bb219C517f01fd6cB3AdB5Cb7aFDB1`, predicted; not created yet | 2026-10-04 (E-024) |
| The user's v1 CurbAccount | Monad mainnet | `0xf774a7013e1A0325830d5B4D9D45980cc30231BB` (verified; holds nothing) | 2026-10-04 (E-024) |
| Web app (Vercel project `curb`, root `web/`), from GitHub on merge to `main` (D-016); no Vercel env vars | Monad mainnet | https://curb-jet.vercel.app (D-014) | 2026-10-04 (E-025) |

Read on mainnet 2026-10-04: the owner key holds 14.83 MON, the trading key 0.90 MON, the deployer 0. A 450 MON swap needs about 460 MON on the owner key: Max leaves Monad's 10 MON reserve plus 0.5 MON for gas.

## Broken or unverified

- **Futures and in-app funding on mainnet are unverified:** no Perpl transaction or Kuru Flow swap from the app on mainnet yet (the phone run).
- Get depends on Kuru Flow's quote API (one quote a second); if it is down, AUSD can still arrive from outside (D-026).
- A v1 account no longer shows in the app; the user's holds nothing.
- Kuru deposits are MON only; USDC deposit deferred (D-018).
- No separate order preview, transaction details screen or custom owner sheet (D-020).
- Orders and History are per device until #40 (D-018). A Perpl fill the app sees only after its id was reused could be credited to the newer order (D-025).
- The Impeccable hero gate stays formally open at 81% (colours the user waived, D-013).

## Open questions

- Does Agora accept a mobile web app as "a mobile application"? (#52; asked in Discord)
