# State

_Last verified: 2026-09-26, branch `2-passkey-two-keys`; repo: https://github.com/emmanuelist/curb (public)_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M0 · Spikes (due 2026-09-28) · **Deadline:** 2026-10-13 23:59 ET · 17 days left
**Next action:** M0 is done except #5 (bounty texts, from the user). #4 is folded into M1 (D-010). Waiting on the user's go-ahead for M1 (#6): scaffold web/, CI, design direction, deploy.
**Blocked on:** #5 needs the bounty texts pasted. M1's exit needs ~50 MON sent to the phone-derived address (D-010).

## Works (verified this session)

| Capability | Verified by | Evidence |
|---|---|---|
| A contract deposits, places, cancels and withdraws on Kuru MON-USDC | fork test `KuruForkTest` passes against mainnet block 108,236,646 | E-001 |
| Passkey PRF on the user's iPhone (Safari) | Mera live demo created an account (`0x6Fa0…6e4a`) | #3 (closed) |
| One passkey → owner + trading keys; trading key signs with no prompt | `spikes/passkey` in Chromium 154 + virtual authenticator + anvil fork | E-002 |

## Deployed

| What | Network | Address / URL | Last checked |
|---|---|---|---|
| — | — | — | — |

## Broken or unverified

- The spike contract has no roles, no price check and no market allowlist. That's M2 (#7).
- `evm_version = cancun` for Monad is assumed, not verified (contracts/foundry.toml). Check before the M2 deploy.
- The bounty requirements aren't captured yet (#5).

## Open questions

- Does Agora's "Best Mobile Trading App" accept a mobile web app? (the user pastes the bounty text, #5)
