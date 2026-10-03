# State

_Last verified: 2026-10-04, branch `51-futures`; repo: https://github.com/emmanuelist/curb (public); live: https://curb-jet.vercel.app_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M2 done 2026-10-03 (E-019); now M3 · Proof surface (due 2026-10-11) · **Deadline:** 2026-10-13 23:59 ET · 9 days left
**Next action:** #50: deploy CurbFactory v2 to mainnet with `forge create`, verify it, and point the app at it. It needs the user's go-ahead and about 0.5 MON sent to the deployer `0x508eF51C834f7B8A5c1E8ECCFebA0F78c1654E87`, which holds 0. Then #51's mainnet run on the user's phone (about 15 AUSD), then #40.
**Blocked on:** the user's go-ahead and MON for #50; Agora's answer on whether a mobile web app counts (#52).

## Works

| Capability | Verified by | Evidence |
|---|---|---|
| **Futures in the app, on a fork (#51):** market switch; Perpl lane from Perpl's onchain book; long and short under a 5× cap drawn as a curb (D-024); position card; AUSD in and out by the owner key; off-lane and over-cap refusals onchain; Orders and History with Perpl orders, cancels and fills, kept apart although Perpl reuses ids (D-025) | anvil + Playwright + virtual passkey; finish review "ship" | E-022 (2026-10-03), E-023 (2026-10-04) |
| CurbAccount v2 also holds the trading key to Perpl's live book and a leverage cap; AUSD in and out by the owner only (D-021) | 39/39 fork tests under Monad rules | E-020, E-021; rerun 2026-10-04 (E-023) |
| **M2 exit on mainnet, from the user's iPhone:** account created and funded; trading key's withdrawal refused onchain (`NotOwner`); a real 200 MON sell placed and cancelled on Kuru; an off-lane buy refused onchain (`OffLane`); owner withdrew 200 MON to the user's wallet | txs found by nonce, decoded with traces; account source exact match | E-019 (2026-10-03) |
| Refusal moment, proofs, owner withdraw and send, on a fork (D-019) | anvil + Playwright + virtual passkey | E-018 (2026-10-03) |
| Create, deposit, place, cancel, fills, Orders and History from the device ledger, on a fork (D-018) | anvil + Playwright + virtual passkey | E-017 (2026-09-28) |
| CurbAccount + CurbFactory enforce the thesis (fork tests under Monad rules); factory live and verified | forge fork tests; deploy tx + Sourcify | E-015, E-016 (2026-09-28) |
| M1: real passkey on the user's iPhone; owner key signs a real mainnet tx with Face ID | tx 0x72c21e7e…4a9ab4 | E-013 (2026-09-28) |
| Production deploys from GitHub on merge; all routes 200 | Vercel status + bundle check + curl | E-012; checked 2026-10-03 |
| Board redesign, identity, performance (phone Lighthouse 84–99, desktop 99) | Playwright, Lighthouse | E-006 to E-011 (2026-09-27) |
| Gate: web lint 0 warnings, typecheck, 53 tests, warning-free build; contracts 39/39, `forge lint` 0, fmt clean; `impeccable detect` 0 | local | E-023 (2026-10-04) |

## Deployed

| What | Network | Address / URL | Last checked |
|---|---|---|---|
| CurbFactory v1 | Monad mainnet | `0x633Bf378031d694Bcb8E39E6CF160efD75Af18e8` (verified) | 2026-09-28 (E-016) |
| The user's CurbAccount (v1, Kuru only) | Monad mainnet | `0xf774a7013e1A0325830d5B4D9D45980cc30231BB` (verified, exact match; margin empty) | 2026-10-03 (E-019) |
| Web app (Vercel project `curb`, root `web/`), from GitHub on merge to `main` (D-016) | Monad mainnet | https://curb-jet.vercel.app (D-014) | 2026-10-03 |

Read on mainnet 2026-10-04 (block 110,309,663): the user's owner key holds 14.63 MON, the trading key 0.90 MON, the deployer 0.

## Broken or unverified

- **Futures on mainnet are unverified:** every Perpl transaction from the app so far ran on a fork (E-022, E-023). Production points at factory v1, so the Perpl market stays hidden there until #50 (D-023).
- Kuru deposits are MON only; USDC deposit deferred (D-018).
- No separate order preview, transaction details screen or custom owner sheet (D-020).
- Orders and History are per device until #40 (D-018). A Perpl fill that the app sees only after its id was reused could be credited to the newer order (D-025).
- The Impeccable hero gate stays formally open at 81% (colours the user waived, D-013).

## Open questions

- Does Agora accept a mobile web app as "a mobile application"? (#52; asked in Discord)
