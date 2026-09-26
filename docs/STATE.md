# State

_Last verified: 2026-09-26 at the foundation commit; repo: https://github.com/emmanuelist/curb (public)_

**Thesis:** A trading key that can't withdraw, and can't trade off Kuru's live order book.
**Milestone:** M0 · Spikes (due 2026-09-28) · **Deadline:** 2026-10-13 23:59 ET · 17 days left
**Next action:** Spike: CurbAccount deposits, places, cancels and withdraws through Kuru on a mainnet fork (#1)
**Blocked on:** nothing for #1 and #2. #4 needs ~$2 of MON and a go-ahead. #5 needs the bounty texts pasted.

## Works (verified this session)

Nothing is built yet. Passkey PRF is confirmed on the user's iPhone in Safari (#3 closed; fails inside Telegram's in-app browser). Verified facts about dependencies (Kuru contracts on mainnet, permissionless order placement, live MON-USDC book, Mera's API) are in docs/CONTEXT.md, with the check behind each one.

## Deployed

| What | Network | Address / URL | Last checked |
|---|---|---|---|
| — | — | — | — |

## Broken or unverified

- Whether Kuru's OrderBook accepts a **contract** as the order owner (all checks so far used EOAs). Resolved by #1.
- The bounty requirements (Kuru consumer trading, Mera ×2, Agora mobile trading) are not captured yet (#5).

## Open questions

- Does Agora's "Best Mobile Trading App" accept a mobile web app? (user pastes the bounty text, #5)
