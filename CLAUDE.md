# Curb — build rules and pinned context

**A trading key that can't withdraw, and can't trade off Kuru's live order book.**

Curb is a mobile-first web app for trading on Kuru, Monad's fully onchain order book. One passkey (Face ID) yields two keys through Mera:

- The **owner key**, derived only when you withdraw. It is the only key that can move money out.
- The **trading key**, which signs orders with no prompts. It can place and cancel orders on Kuru markets, and nothing else.

A contract account (`CurbAccount`) enforces the split onchain. Every order the trading key places is checked, in the same transaction, against Kuru's live best bid/ask. That check is only possible because Kuru's book lives onchain.

Entered in **Monad Metropolis, Track 1 (Onchain Finance & Trading)**. The deadline is **2026-10-13 23:59 ET**. Research, strategy and bounty notes live in `internal/` (gitignored); start with `internal/research/DOSSIER.md`.

## Current state

@docs/STATE.md

## Repo layout (planned. Nothing is scaffolded until M1; see docs/PLAN.md)

```
contracts/   Foundry: CurbAccount + tests (fork tests against Monad mainnet)   [M0 spike → M2]
web/         Next.js mobile-first app: Mera passkeys, viem, Kuru reads/writes   [M1]
spikes/      throwaway M0 spikes kept with their evidence (not product code)
docs/        STATE, PLAN, DECISIONS, EVIDENCE, CONTEXT
internal/    research dossier, raw captures, strategy (gitignored, never commit)
```

## Pinned versions

Latest on npm as of 2026-09-26. Pin exactly in package.json at scaffold (M1) and update this table if anything changes.

| | |
|---|---|
| Node | ≥ 22 |
| Package manager | npm (pnpm is not installed; don't add a second lockfile) |
| Next.js | 16.3.6, App Router only. **The Pages Router must never appear.** |
| React | 19.2.8 (what Next 16.3.6 ships) |
| Tailwind CSS | 4.3.3, CSS-first config. **No `tailwind.config.js` in v3 style.** |
| viem | 2.56.9 exact (Mera's peer range is ^2.28.0) |
| @category-labs/mera | **0.2.0 exact.** New library, pre-1.0; read its `.d.ts` before using anything. |
| Foundry | forge 1.4.4 |
| TypeScript | 5.9.3 (Next 16.3.6 template), target ES2022 (BigInt) |
| TanStack Query | 5.104.0. All async and onchain reads go through it (D-011). |
| Vitest | 3.2.7 (`npm test`) |
| @scure/bip32 · @scure/bip39 · @noble/hashes | 2.4.0 · 2.4.0 · 2.2.0 exact (Mera's key recipe, D-012) |
| lucide-react | 1.48.0 exact. The only icon set; line icons at 1.7–2.4 stroke (D-013). |
| wagmi | **Not used** (D-011): there's no browser wallet, since passkey → Mera → viem signs. |
| Motion | Optional, only for gesture and spring interactions CSS can't express (BRIEF §15). Verify the version at scaffold. |
| ethers | **Never in the web runtime.** `@kuru-labs/kuru-sdk` bundles ethers 5.7.1. Use the SDK only for its ABI JSON files; call Kuru through viem (D-003). |

## Rules

1. **No mocks, no fake data, no demo mode.** Every rendered value comes from Monad (Kuru's book, balances, our contract) or from the user's passkey. The chain is the only store; there is no backend database.
2. **Verify every SDK call against installed types before writing it**: `node_modules/@category-labs/mera/dist/*.d.ts`, viem's types, and the Kuru ABI JSON. If a method can't be verified, stop and say so. Verified surfaces are recorded in `docs/CONTEXT.md`.
3. **Phase-gated.** Build the current milestone only (docs/PLAN.md), then stop for confirmation.
4. **Tests cover the refusal paths first.** The product *is* the refusals: trading-key withdrawal refused, off-book order refused, non-whitelisted market refused. Fork tests against Monad mainnet prove them.
5. **Money is `bigint` in base units end to end.** Kuru price/size precision conversions live in one module, with tests. Never pass a float onchain.
6. **Mainnet safety.** Dev and tests run on an anvil fork of Monad mainnet. Any script that sends a real mainnet transaction needs the user's explicit go-ahead and a hard cap on value. Never self-trade: filling our own resting orders is wash trading (rules §8.2).
7. **Keys.** The owner key is derived on demand and never persisted. The trading key is never stored in plaintext. Private keys and seeds never appear in the repo, logs, screenshots or the demo video.
8. **No secrets in the repo.** Env vars only; blank-valued keys in `.env.example`.
9. **Never scope-cut silently.** Present tradeoffs on technical merit (security model, attack surface, latency), and record cuts in docs/DECISIONS.md.
10. **The public repo is public from day one** (rules §7.2). Nothing from `internal/` is ever committed. The README must disclose AI coding tool use (rules §4.1.4).

## Frontend conventions

Set at M1 via the `premium-product-design` skill. Until then: mobile-first at a 375px baseline; design tokens in `web/src/app/globals.css`; every animation respects `prefers-reduced-motion`; a failed async call must never strand a flow in an in-flight state.

## Verification before any milestone closes

```bash
npm run lint -- --max-warnings 0   # web
npm run typecheck                  # web
npm test                           # web (vitest)
npm run build                      # web, must be warning-free
forge test                         # contracts (fork tests need MONAD_RPC_URL)
```

## Where things live

| Concern | File |
|---|---|
| Milestones and exit criteria | docs/PLAN.md |
| Work items | GitHub issues on emmanuelist/curb (`gh issue list --milestone "<current>"`); milestone titles match docs/PLAN.md |
| Why we chose what we chose | docs/DECISIONS.md (append-only) |
| Proof that things work | docs/EVIDENCE.md (append-only) |
| Verified facts about dependencies, and traps | docs/CONTEXT.md. Read it before touching Kuru, Mera or Monad specifics. |
| Design and frontend spec | docs/BRIEF.md (amendments first) |
| Research, bounty requirements, strategy, concept art | internal/ (gitignored) |

## Operating protocol

- **Start:** STATE is loaded above. Read the open issues for the current milestone and the last 3 entries of docs/DECISIONS.md. Say the next action back before starting.
- **Work:** one issue at a time, on a branch `<issue>-<slug>`. Each PR (or commit, before the remote exists) references the issue and carries its evidence.
- **Finish** (or `/foundation handoff`): append EVIDENCE and DECISIONS, update CONTEXT with anything verified, close issues with evidence links, rewrite docs/STATE.md, commit.
- **Truth rule:** never write a claim into STATE, README, an issue or a PR that wasn't verified this session. Write "unverified" instead.
- **Decisions:** never relitigate an accepted decision without new evidence; supersede it with a new entry.
