# State

_Last verified: 2026-09-26, branch `6-m1-scaffold`; repo: https://github.com/emmanuelist/curb (public)_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M1 · Walking skeleton (due 2026-10-02) · **Deadline:** 2026-10-13 23:59 ET · 17 days left
**Next action:** Ask the user before the first Vercel deploy (#6), then run the real-phone check: the user funds the owner key with ~50 MON and sends gas to the trading key with Face ID (D-010).
**Blocked on:** the user's go-ahead to deploy; ~50 MON from the user for the phone check; the bounty texts (#5).

## Works (verified this session)

| Capability | Verified by | Evidence |
|---|---|---|
| A contract deposits, places, cancels and withdraws on Kuru MON-USDC | fork test `KuruForkTest` | E-001 |
| One passkey → owner and trading keys; the trading key signs with no prompt | spikes/passkey | E-002 |
| Passkey PRF on the user's iPhone (Safari) | Mera live demo | #3 |
| Trade screen on live data; lane dashes step once per real block | Playwright on mainnet data | E-003 |
| Onboarding, owner-key tx, sign-in recovery, in-app guard | Playwright + virtual authenticator + anvil fork | E-004 |
| Gate: lint (0 warnings), typecheck, 17 tests, warning-free build; contracts fork test | CI on GitHub | E-005 |

## Deployed

| What | Network | Address / URL | Last checked |
|---|---|---|---|
| — | — | not deployed yet (needs the user's go-ahead) | — |

## Broken or unverified

- The Buy button is disabled until CurbAccount exists (M2, #7), and the UI says so.
- `evm_version = cancun` for Monad is still assumed (contracts/foundry.toml).
- Visual pass at 430 and 1280 not done yet (390/768/1440 checked).

## Open questions

- Does Agora's "Best Mobile Trading App" accept a mobile web app? (#5)
