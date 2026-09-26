# Curb

**A trading key that can't withdraw, and can't trade off Kuru's live order book.**

Curb is a mobile-first web app for trading on [Kuru](https://kuru.io), the fully onchain order book on Monad. One passkey (Face ID) produces two keys:

- an **owner key**, the only key that can move money out
- a **trading key** that places and cancels orders with no prompts, and nothing else

A contract account enforces the split onchain. It also checks every order against Kuru's live best bid and ask in the same transaction.

Built for Monad Metropolis (Track 1: Onchain Finance & Trading), 1 Sep – 13 Oct 2026.

## Status

In development. Nothing is deployed yet. Setup instructions, architecture, contract addresses and the demo video will land here as each part is proven. Progress is tracked in [docs/PLAN.md](docs/PLAN.md), and every claim this README makes will link to [docs/EVIDENCE.md](docs/EVIDENCE.md).

## AI disclosure

This project is built with AI coding assistance (Claude Code), as permitted and required to be disclosed by the Metropolis rules (§4.1.4). Design decisions and their reasons are recorded in [docs/DECISIONS.md](docs/DECISIONS.md).

## License

[MIT](LICENSE)
