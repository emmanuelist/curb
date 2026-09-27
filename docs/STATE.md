# State

_Last verified: 2026-09-27, branch `6-git-deploy-evidence`; repo: https://github.com/emmanuelist/curb (public); live: https://curb-jet.vercel.app_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M1 · Walking skeleton (due 2026-10-02) · **Deadline:** 2026-10-13 23:59 ET · 16 days left
**Next action:** The real-phone check on https://curb-jet.vercel.app (D-010, #6): the user creates an account in Safari, funds the owner key with ~50 MON, and sends gas to the trading key with Face ID.
**Blocked on:** ~50 MON from the user for the phone check; the bounty texts (#5).

## Works (E-006 to E-012 and the web gate verified 2026-09-27; E-001 to E-005 verified 2026-09-26)

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
| Live green (D-015), favicon, app icons, manifest, share card, 404 and error pages, on production | Playwright + build output + curl on production | E-008, E-009 |
| Performance pass on production: phone Lighthouse 84–99 (SEO, a11y, best practices 100), desktop 99; LCP photo eager, High, AVIF; passkey code off the home page | Lighthouse + CDP metrics + fork harness | E-010, E-011, E-012 |

## Deployed

| What | Network | Address / URL | Last checked |
|---|---|---|---|
| Web app (Vercel project `curb`, root `web/`), deployed from GitHub on merge to `main` (D-016) | Monad mainnet (reads) | https://curb-jet.vercel.app (D-014) | 2026-09-27 (E-007, E-009, E-012) |

## Broken or unverified

- The Buy button is disabled until CurbAccount exists (M2, #7), and the UI says so.
- `evm_version = cancun` for Monad is still assumed (contracts/foundry.toml).
- The Impeccable hero gate stays formally open at 81%: its last two controls differ only by the colours the user waived (D-013).

## Open questions

- Does Agora's "Best Mobile Trading App" accept a mobile web app? (#5)
