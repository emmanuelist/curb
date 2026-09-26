# State

_Last verified: 2026-09-26, branch `1-kuru-fork-spike`; repo: https://github.com/emmanuelist/curb (public)_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M0 · Spikes (due 2026-09-28) · **Deadline:** 2026-10-13 23:59 ET · 17 days left
**Next action:** Spike #2: one passkey → two keys via Mera PRF in headless Chromium (virtual authenticator), and one signs a tx a mainnet fork accepts.
**Blocked on:** nothing for #2. #4 needs ~$2 of MON and a go-ahead. #5 needs the bounty texts pasted.

## Works (verified this session)

| Capability | Verified by | Evidence |
|---|---|---|
| A contract deposits, places, cancels and withdraws on Kuru MON-USDC | fork test `KuruForkTest` passes against mainnet block 108,236,646 | E-001 |
| Passkey PRF on the user's iPhone (Safari) | Mera live demo created an account (`0x6Fa0…6e4a`) | #3 (closed) |

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
