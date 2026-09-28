# State

_Last verified: 2026-09-28, branch `31-deploy-factory`; repo: https://github.com/emmanuelist/curb (public); live: https://curb-jet.vercel.app_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M1 done 2026-09-28 (E-013); next M2 · Core claim (due 2026-10-08) · **Deadline:** 2026-10-13 23:59 ET · 15 days left
**Next action:** #32: the app creates the user's CurbAccount (owner Face ID → factory), deposits MON into its Kuru margin, and places and cancels orders with the trading key (no prompt).
**Blocked on:** the bounty texts (#5).

## Works (E-013 verified 2026-09-28; E-006 to E-012 and the web gate 2026-09-27; E-001 to E-005 verified 2026-09-26)

| Capability | Verified by | Evidence |
|---|---|---|
| A contract deposits, places, cancels and withdraws on Kuru MON-USDC | fork test `KuruForkTest` | E-001 |
| One passkey → owner and trading keys; the trading key signs with no prompt | spikes/passkey | E-002 |
| Passkey PRF on the user's iPhone (Safari) | Mera live demo | #3 |
| Trade screen on live data; lane dashes step once per real block | Playwright on mainnet data | E-003 |
| Onboarding, owner-key tx, sign-in recovery, in-app guard | Playwright + virtual authenticator + anvil fork | E-004 |
| Gate: lint (0 warnings), typecheck, 17 tests, warning-free build; contracts fork test | CI on GitHub | E-005 |
| Board redesign (D-013) on every screen, live data, 390–1440 with no overflow; finish review `ship` | Playwright + Impeccable comp-diff, detector, reviewer | E-006 |
| Production deploy on live mainnet data, blocks streaming, zero console errors | curl + Playwright on https://curb-jet.vercel.app | E-007 |
| **M1 exit:** real passkey on the user's iPhone creates the account; owner key sends a real mainnet tx with Face ID | tx 0x72c21e7e…4a9ab4, status 1 | E-013 |
| CurbAccount + CurbFactory enforce the thesis on a mainnet fork: trader withdrawal and off-lane orders revert; in-lane orders rest on Kuru and cancel; owner withdraws out | forge fork tests under Monad rules | E-015 |
| CurbFactory live on mainnet, source verified | deploy tx + Sourcify exact match | E-016 |
| Live green (D-015), favicon, app icons, manifest, share card, 404 and error pages, on production | Playwright + build output + curl on production | E-008, E-009 |
| Performance pass on production: phone Lighthouse 84–99 (SEO, a11y, best practices 100), desktop 99; LCP photo eager, High, AVIF; passkey code off the home page | Lighthouse + CDP metrics + fork harness | E-010, E-011, E-012 |

## Deployed

| What | Network | Address / URL | Last checked |
|---|---|---|---|
| CurbFactory | Monad mainnet | `0x633Bf378031d694Bcb8E39E6CF160efD75Af18e8` (verified) | 2026-09-28 (E-016) |
| Web app (Vercel project `curb`, root `web/`), deployed from GitHub on merge to `main` (D-016) | Monad mainnet (reads) | https://curb-jet.vercel.app (D-014) | 2026-09-27 (E-007, E-009, E-012) |

## Broken or unverified

- The Buy button is disabled until CurbAccount exists (M2, #7), and the UI says so.
- The Impeccable hero gate stays formally open at 81%: its last two controls differ only by the colours the user waived (D-013).

## Open questions

- Does Agora's "Best Mobile Trading App" accept a mobile web app? (#5)
