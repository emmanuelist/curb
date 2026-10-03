# State

_Last verified: 2026-10-04, branch `50-factory-v2`; repo: https://github.com/emmanuelist/curb (public); live: https://curb-jet.vercel.app_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M2 done 2026-10-03 (E-019); now M3 · Proof surface (due 2026-10-11) · **Deadline:** 2026-10-13 23:59 ET · 9 days left
**Next action:** #51's mainnet run on the user's phone: about 15 AUSD onto the owner key `0x222Bc473153617Db03455Ab18C1cab8D6249037C`; then create the v2 account (Face ID), add AUSD, open a long at the cap, prove both refusals, close, and withdraw. Then #40.
**Blocked on:** AUSD on the owner key (the user); Agora's answer on whether a mobile web app counts (#52).

## Works

| Capability | Verified by | Evidence |
|---|---|---|
| **CurbFactory v2 live and verified on mainnet (#50);** the app pointed at it reads Perpl's live mainnet book through the deployless reader on the public RPC | deploy tx + Sourcify exact match + reads; `next dev` on mainnet + Playwright | E-024 (2026-10-04) |
| **Futures in the app, on a fork (#51):** market switch; Perpl lane from Perpl's onchain book; long and short under a 5× cap drawn as a curb (D-024); position card; AUSD in and out by the owner key; off-lane and over-cap refusals onchain; Orders and History with Perpl orders, cancels and fills, kept apart although Perpl reuses ids (D-025) | anvil + Playwright + virtual passkey; finish review "ship" | E-022 (2026-10-03), E-023 (2026-10-04) |
| CurbAccount v2 also holds the trading key to Perpl's live book and a leverage cap; AUSD in and out by the owner only (D-021) | 39/39 fork tests under Monad rules | E-020, E-021; rerun 2026-10-04 (E-023) |
| **M2 exit on mainnet, from the user's iPhone (v1 account):** account created and funded; trading key's withdrawal refused onchain (`NotOwner`); a real 200 MON sell placed and cancelled on Kuru; an off-lane buy refused onchain (`OffLane`); owner withdrew 200 MON to the user's wallet | txs found by nonce, decoded with traces; account source exact match | E-019 (2026-10-03) |
| Refusal moment, proofs, owner withdraw and send, on a fork (D-019) | anvil + Playwright + virtual passkey | E-018 (2026-10-03) |
| Create, deposit, place, cancel, fills, Orders and History from the device ledger, on a fork (D-018) | anvil + Playwright + virtual passkey | E-017 (2026-09-28) |
| M1: real passkey on the user's iPhone; owner key signs a real mainnet tx with Face ID | tx 0x72c21e7e…4a9ab4 | E-013 (2026-09-28) |
| Production deploys from GitHub on merge; all routes 200; #51's code live with the Perpl market hidden under factory v1 | Vercel status + bundle grep + curl + Playwright | 2026-10-04 (PR #54) |
| Board redesign, identity, performance (phone Lighthouse 84–99, desktop 99) | Playwright, Lighthouse | E-006 to E-011 (2026-09-27) |
| Gate: web lint 0 warnings, typecheck, 53 tests, warning-free build; contracts 39/39, `forge lint` 0, fmt clean; `impeccable detect` 0 | local + CI on PR #54 | E-023 (2026-10-04) |

## Deployed

| What | Network | Address / URL | Last checked |
|---|---|---|---|
| **CurbFactory v2** (the app's factory from #50's merge) | Monad mainnet | `0xC3b37bfa0c4496005F01a9E92cD5d285398db000` (verified, exact match) | 2026-10-04 (E-024) |
| CurbFactory v1 (Kuru only; the app no longer uses it) | Monad mainnet | `0x633Bf378031d694Bcb8E39E6CF160efD75Af18e8` (verified) | 2026-09-28 (E-016) |
| The user's v2 CurbAccount | Monad mainnet | `0x59C87e37a9bb219C517f01fd6cB3AdB5Cb7aFDB1`, predicted by the factory; not created yet | 2026-10-04 (E-024) |
| The user's v1 CurbAccount | Monad mainnet | `0xf774a7013e1A0325830d5B4D9D45980cc30231BB` (verified; holds nothing) | 2026-10-04 (E-024) |
| Web app (Vercel project `curb`, root `web/`), from GitHub on merge to `main` (D-016); no Vercel env vars, so the registry's factory applies | Monad mainnet | https://curb-jet.vercel.app (D-014) | 2026-10-04 |

Read on mainnet 2026-10-04: the owner key holds 14.83 MON (after the deployer's refund), the trading key 0.90 MON, the deployer 0.

## Broken or unverified

- **Futures on mainnet are unverified:** no Perpl transaction from the app on mainnet yet (#51's phone run).
- With the app on v2, a v1 account no longer shows in the app; its history stays on the device ledger under the v1 address and on Monadscan. The user's v1 account holds nothing.
- Kuru deposits are MON only; USDC deposit deferred (D-018).
- No separate order preview, transaction details screen or custom owner sheet (D-020).
- Orders and History are per device until #40 (D-018). A Perpl fill that the app sees only after its id was reused could be credited to the newer order (D-025).
- The Impeccable hero gate stays formally open at 81% (colours the user waived, D-013).

## Open questions

- Does Agora accept a mobile web app as "a mobile application"? (#52; asked in Discord)
- The easiest way for the user to get AUSD onto the owner key (the key lives in the passkey, so it can't connect to a DEX).
