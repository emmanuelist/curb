# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Traders**, crypto-savvy, on phone and desktop. They want to trade on Kuru, Monad's fully onchain order book, from a self-custodial account without a seed phrase and without approving every order.
- **Metropolis judges** (investors, Monad's founders, sponsor DevRel) evaluate the product in about four minutes, mostly on laptops. They are the first audience that decides whether Curb matters.

## Product Purpose

Curb is a mobile-first web app for trading on Kuru. One passkey yields two keys:

- The **owner key** is the only key that moves money in or out. It is re-derived with a biometric prompt every time.
- The **trading key** places and cancels orders with no prompt. It can't withdraw, and it can't trade outside Kuru's live best bid/ask ±0.50%.

A contract account enforces both limits onchain. Success is fast, prompt-free trading whose limits a person can see and verify, and whose refusals happen onchain, not just in the app.

## Positioning

"A trading key that can't withdraw, and can't trade off Kuru's live order book." The price limit is checked against Kuru's book in the same transaction. That is only possible because Kuru's order book lives onchain on Monad; a venue with offchain matching couldn't offer it.

## Operating Context

- Monad mainnet (chain 143): ~400 ms blocks, WebSocket block stream, Kuru MON-USDC market.
- Accounts come from passkeys through Mera (WebAuthn PRF). Passkeys work in Safari, and in Chrome with iCloud Keychain or Google Password Manager. They fail inside in-app browsers (Telegram, X, Discord).
- Judges watch a demo video of at most 3 minutes and may open the live app on their own devices.

## Capabilities and Constraints

- **Built:** live Kuru book and lane, onboarding, keys with balances, the owner-key gas transfer.
- **Next:** CurbAccount with order placement and onchain refusals.
- Real data only: no mock data, no fabricated hashes, balances or confirmations. A development fork of mainnet is the test environment.
- **Colour meanings are product semantics:**
  - white is the trading key
  - kerb yellow is the owner key and money moving
  - red is an onchain refusal only, never price direction
- Lane boundaries always come from the same numbers the contract enforces.
- Hackathon deadline: 2026-10-13 23:59 ET. The code is public on GitHub.

## Brand Commitments

- Name: **Curb**. The visual language comes from the street: curbs, road markings, lane restrictions, asphalt, signage, and the history of curbside trading (the New York Curb Exchange).
- **Binding visual reference:** the user's concept board (`internal/design/curb-concept-board-2026-09-26.png`). Match its polish, layered surfaces, iconography, pills and photographic asphalt material. Where it conflicts with the colour meanings above, the meanings win (user decision, 2026-09-26).
- Design spec: `docs/BRIEF.md` (the user's master brief, adopted with amendments D-011).

## Evidence on Hand

- Live, verifiable data: Kuru MON-USDC book, Monad blocks, contract addresses (`docs/CONTEXT.md`).
- Evidence log: `docs/EVIDENCE.md` (fork tests, the passkey spike, end-to-end onboarding).
- No customers, testimonials or usage numbers exist. None may be invented.
- Photography comes from licensed stock and is credited; the board's concept art is never shown as the product.

## Product Principles

1. Restrictions are visible before they bite: every limit is drawn, and every action names its signer.
2. Show onchain truth, never simulate it.
3. Speed with a leash: no prompts for trading, a biometric for anything that moves money out.
4. Judges understand the claim within one screen.

## Accessibility & Inclusion

WCAG AA contrast, keyboard access, reduced motion honoured, and colour never the only carrier of meaning.
