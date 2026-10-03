# State

_Last verified: 2026-10-03, branch `49-curb-perpl`; repo: https://github.com/emmanuelist/curb (public); live: https://curb-jet.vercel.app_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M2 done 2026-10-03 (E-019); now M3 · Proof surface (due 2026-10-11) · **Deadline:** 2026-10-13 23:59 ET · 10 days left
**Next action:** #51, futures in the app (AUSD balance, Perpl lane, long/short with the cap, positions) on a fork, against CurbAccount v2 (#49, fork-tested, E-021). Then #50 (deploy factory v2: needs the user's go-ahead and about 0.5 MON on the deployer), then #40.
**Blocked on:** Agora's answer on whether a mobile web app counts (#52, the user asked in Discord).

## Works

| Capability | Verified by | Evidence |
|---|---|---|
| CurbAccount v2 also holds the trading key to Perpl's live book and a leverage cap; AUSD in and out by the owner only (D-021) | 36/36 fork tests under Monad rules | E-020, E-021 (2026-10-03) |
| **M2 exit on mainnet, from the user's iPhone:** account created and funded; trading key's withdrawal refused onchain (`NotOwner`); a real 200 MON sell placed and cancelled on Kuru; an off-lane buy refused onchain (`OffLane`); owner withdrew 200 MON to the user's wallet | txs found by nonce, decoded with traces; account source exact match | E-019 (2026-10-03) |
| Refusal moment, proofs, owner withdraw and send, on a fork (D-019) | anvil + Playwright + virtual passkey; finish review fixes applied | E-018 (2026-10-03) |
| Create, deposit, place, cancel, fills, Orders and History from the device ledger, on a fork (D-018) | anvil + Playwright + virtual passkey | E-017 (2026-09-28) |
| CurbAccount + CurbFactory enforce the thesis (fork tests under Monad rules); factory live and verified | forge fork tests; deploy tx + Sourcify | E-015, E-016 (2026-09-28) |
| M1: real passkey on the user's iPhone; owner key signs a real mainnet tx with Face ID | tx 0x72c21e7e…4a9ab4 | E-013 (2026-09-28) |
| Production deploys from GitHub on merge; #38's code is live; all routes 200 | Vercel status + bundle check + curl | E-012; checked 2026-10-03 |
| Board redesign, identity, performance (phone Lighthouse 84–99, desktop 99) | Playwright, Lighthouse | E-006 to E-011 (2026-09-27) |
| Gate: lint (0 warnings), typecheck, 35 tests, warning-free build; contracts fork tests | local + CI | E-018 (2026-10-03) |

## Deployed

| What | Network | Address / URL | Last checked |
|---|---|---|---|
| CurbFactory | Monad mainnet | `0x633Bf378031d694Bcb8E39E6CF160efD75Af18e8` (verified) | 2026-09-28 (E-016) |
| The user's CurbAccount | Monad mainnet | `0xf774a7013e1A0325830d5B4D9D45980cc30231BB` (verified, exact match; margin empty) | 2026-10-03 (E-019) |
| Web app (Vercel project `curb`, root `web/`), from GitHub on merge to `main` (D-016) | Monad mainnet | https://curb-jet.vercel.app (D-014) | 2026-10-03 |

The user's owner key holds 14.63 MON and the trading key 0.90 MON: gas for recording the demo. A sell needs 200 MON deposited again.

## Broken or unverified

- Deposits are MON only; USDC deposit deferred (D-018).
- No separate order preview, transaction details screen or custom owner sheet (D-020).
- Orders and History are per device (D-018).
- The Impeccable hero gate stays formally open at 81% (colours the user waived, D-013).

## Open questions

- Does Agora accept a mobile web app as "a mobile application"? (#52; asked in Discord)
