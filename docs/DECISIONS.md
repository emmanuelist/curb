# Decisions

Append-only. To change a decision, add a new entry that supersedes it.

## D-001 · Build Curb: passkey trading on Kuru with a key that can't withdraw · 2026-09-26 · accepted

**Context:** Metropolis research (internal/research/DOSSIER.md). Six candidates, scored against the official rubric (Rules §5.2) and a strategic matrix.
**Decision:** Build Curb for Track 1 (Onchain Finance & Trading). Target these bounties:

- Kuru "Build the Next Consumer Trading App"
- Mera "Best Mera-Powered UX"
- Mera "One Passkey, Many Keys"
- Agora "Best Mobile Trading App", if its text accepts mobile web

**Alternatives:**

- Cultural-outcome markets on Kuru (Track 3) ties on the rubric. It's weaker on the demo: we'd have to seed the liquidity ourselves, it needs counterparties, and self-trading an outcome token counts as wash trading. It also has less bounty money, and Kuru market creation is gated on mainnet (open on testnet only).
- AUSD cross-border corridor: a crowded bounty (3 visible entrants), and it fails the only-on-Monad test.
- Agent wallet: Track 4 is the most crowded track.

**Consequences:**

- Track 1, not Track 2. Rules §3.3: Track 2 is "a financial experience rather than a trading or market making product".
- The differentiation from Kuru's own web app (which already has an embedded wallet) must be the scoped keys plus the onchain book check.

**Evidence:** DOSSIER §4 (saturation), §6 (feasibility), §7 (scoring); internal/research/raw/chain-checks-2026-09-26.md.

## D-002 · Mobile-first web app, not native · 2026-09-26 · accepted

**Context:** The user has never built React Native/Expo. Native passkeys need Associated Domains (believed to require a paid Apple Developer account) and an app-site-association file on our own domain. Judges would need TestFlight or an APK to try it.
**Decision:** Next.js, mobile-first, installable to the home screen. Mera's own demo runs in mobile Safari.
**Alternatives:** React Native + Mera's `react-native-webauthn-client` would have made Agora's mobile bounty certain, but it adds too many first-time unknowns for about 15 build days.
**Consequences:** The Agora mobile bounty depends on its text accepting mobile web.
**Evidence:** DOSSIER Decision section; Mera README "Supported platforms".

## D-003 · viem + Mera; call Kuru through viem with the SDK's ABI files · 2026-09-26 · accepted

**Context:** Mera's signing adapter is `toViemAccount` from `@category-labs/mera/viem`. `@kuru-labs/kuru-sdk` 0.0.95 is built on ethers 5.7.1.
**Decision:** viem is the only EVM client in the web app. Kuru contracts are called directly with ABIs from `@kuru-labs/kuru-sdk/abi/*.json` (or vendored copies with attribution).
**Alternatives:** Using the Kuru SDK's ethers path would mean two EVM stacks in the bundle and an adapter from a Mera viem account to an ethers signer.
**Consequences:** Price/size precision math (the SDK's `ParamCreator` logic) is reimplemented in bigint in one tested module.
**Evidence:** Mera `dist/viem.d.ts`; `npm view @kuru-labs/kuru-sdk dependencies` → ethers 5.7.1.

## D-004 · A plain contract account (CurbAccount), not EIP-7702 delegation · 2026-09-26 · accepted

**Context:** The trading-key restrictions must be enforced onchain. Monad docs (reported via summary, not yet captured verbatim) say delegated EOAs can't drop below 10 MON, and CREATE/CREATE2 are banned in delegated code.
**Decision:** Each user gets a CurbAccount contract. The owner (passkey key A) has full control. The trader (passkey key B) may only call an allowlist of Kuru functions on allowlisted markets, with a price check against `bestBidAsk()` in the same transaction.
**Alternatives:** EIP-7702 delegation of the owner EOA would force a 10 MON floor on the owner's address.
**Consequences:** CurbAccount is Kuru's order owner. This must be proven in M0 #1, because Kuru's contract could in principle reject contract callers.
**Evidence:** pending #1.

## D-005 · Mainnet for the product; mainnet fork for development · 2026-09-26 · accepted

**Context:** The rules allow mainnet or testnet (§4.1.3). Kuru's real liquidity is on mainnet: MON-USDC has a live two-sided book, while MON-AUSD is empty.
**Decision:** The demo and deployment run on Monad mainnet (chain 143) against MON-USDC. Development and tests run on an anvil fork of mainnet. Testnet isn't used.
**Alternatives:** Testnet is free, but there would be no real counterparties, and fills matter for the demo.
**Consequences:** A small amount of real funds is needed. Every mainnet transaction script needs the user's go-ahead (CLAUDE.md rule 6).
**Evidence:** internal/research/raw/chain-checks-2026-09-26.md (Liquidity section).

## D-006 · Public GitHub repo from day one · 2026-09-26 · proposed (awaiting user)

**Context:** Rules §7.2: "Code must be publicly accessible on GitHub throughout and after the Hackathon"; §4.1.1 requires a commit history covering the build window.
**Decision:** Create the GitHub repo public now. Keep strategy in the gitignored `internal/`.
**Alternatives:** Staying private until submission would contradict "throughout".
**Consequences:** Competitors can see the work (and the rules make submissions non-confidential anyway, §5.3).
**Evidence:** internal/research/raw/metropolis-rules-v3.0-2026-09-26.md.

## D-007 · Demo video: real footage, edited in Remotion, narrated with ElevenLabs · 2026-09-26 · accepted

**Context:** Rules §9.4: the video must be ≤ 3 minutes, "show the product in actual operation (not mockups or slides)" and show Monad interactions. The agent can drive the app with browser tools, so recording doesn't depend on the user's time.
**Decision:**

1. Capture real screen recordings of the deployed app doing mainnet transactions. The agent drives it with Playwright and a virtual passkey. Add one clip of real Face ID on the user's phone, since a real biometric prompt is more convincing than a virtual one.
2. Assemble in Remotion: captions, zooms on the two refusal moments, explorer-link callouts, and a hard 3:00 cap.
3. Narrate with ElevenLabs.

**Alternatives:**

- An animated explainer rendered entirely in Remotion would violate §9.4.
- Higgsfield-style generated video, same problem.
- The user recording live: possible, but it costs their time and makes retakes slower.

**Consequences:**

- Needs `ELEVENLABS_API_KEY` from the user.
- Remotion lives in its own folder (`video/`) so it never touches the app bundle.
- Every frame of the product must be real. Overlays can explain but never simulate.

**Evidence:** internal/research/raw/metropolis-rules-v3.0-2026-09-26.md §9.4.

## D-008 · Real Face ID footage is optional; a real-device check is required · 2026-09-26 · accepted

**Context:** D-007 planned one clip of real Face ID. The user asked whether it's necessary. Rules §9.4 require real operation, which footage with a virtual authenticator satisfies. But a virtual authenticator completes silently, so no biometric prompt appears on screen. Judges may also open the app on their own phones, and only real hardware proves PRF works there.
**Decision:**

- A real Face ID or Touch ID clip in the video is **optional**. The cheapest route is the agent driving the user's real Chrome or Safari on their Mac while the user touches Touch ID.
- If the video uses only the virtual authenticator, the narration never calls it Face ID, and the README says the recording used a simulated authenticator (rules §10.1: no misleading information).
- **Required before submission:** one account creation on a real phone. The user's iPhone runs iOS 18.7.9, which is supported per Mera's table.

**Alternatives:** none needed; this narrows D-007.
**Consequences:** #3 splits into 3a (PRF on the user's iPhone via Mera's live demo; no funds, required) and 3b (one mainnet tx; needs about $2 and the user's go-ahead).
**Evidence:** internal/research/raw/mera-authenticator-support-2026-09-26.md.

## D-009 · Repo is public on GitHub; issues moved there · 2026-09-26 · accepted (supersedes D-006's "proposed" status)
**Context:** The user approved D-006.
**Decision:** https://github.com/emmanuelist/curb is public. Work items live in GitHub issues with milestones M0–M4 (due 23:59 ET on the PLAN dates). docs/ISSUES.md is deleted.
**Alternatives:** none.
**Consequences:** The local numbering in D-008 maps to GitHub as follows: 3a → **#3** (closed, verified), 3b → **#4**, bounty texts → **#5**. Placeholders are #6–#9 for M1–M4.
**Evidence:** GitHub issues #1–#9; the #3 closing comment.

## D-010 · Fold the "real mainnet tx" spike (#4) into M1's exit test · 2026-09-26 · accepted
**Context:** #4 asked for one real mainnet tx from a Mera-derived key. E-002 already proves the signing path (a fork tx with zero prompts), and #3 proves PRF works on the user's iPhone. Funding a key that lives only in a virtual authenticator risks losing the funds when the browser session ends.
**Decision:** Close #4. The real-mainnet check moves to M1 (#6), whose exit criterion is already stronger: from the deployed URL, on the user's phone, a real passkey creates the account and sends one real Monad mainnet tx.
**Alternatives:** Persist the virtual authenticator's credential and fund it now. That adds ceremony and money risk for no extra confidence.
**Consequences:** M0's exit criterion (3) is dropped. M1 needs the user to send a little MON (about 50 MON ≈ $1.35 at 0.027) to the phone-derived address. Real Kuru orders in M2 need ≥ $6 USDC (the minimum order is 200 MON) plus gas.
**Evidence:** E-002; #3; docs/PLAN.md M1.

## D-011 · Adopt the master build brief with seven amendments · 2026-09-26 · accepted
**Context:** The user supplied a full design and frontend brief (now docs/BRIEF.md) and an AI-generated concept board. The brief formalises the painted-curb direction drawn on the design canvas. Parts of it conflict with the hackathon rules, earlier decisions, or the calendar.
**Decision:** docs/BRIEF.md is the design and frontend spec. Its amendments block takes precedence:

1. No mock data layer. Dev runs on an anvil fork of mainnet; fixtures live in tests only.
2. No wagmi (D-003 stands). TanStack Query for onchain state.
3. Scope is 11 thesis-carrying screens, with the rest cut openly.
4. Onboarding added, with an in-app-browser guard and PRF error guidance.
5. Desktop terminal is first-class from M1.
6. The brief's hex colours are canonical, plus P3 versions.
7. The concept board is a mood reference only and is never published.

**Alternatives:** Adopting the brief as written (24 screens, a mock layer, wagmi) risks rules §9.1 ("not a mockup") and the 2026-10-13 deadline.
**Consequences:**

- PLAN milestones now map the brief's phases: M1 = phases 1–2 plus onboarding and deploy; M2 = phases 3–5 plus CurbAccount; M3 = phases 7–11 plus proof.
- The cut list grows.
- The design canvas used draft colours (#151516 / #f2efe6 / #ffd12a / #e8372c). The code uses the brief's values.

**Evidence:** docs/BRIEF.md; user choice "Adopt with amendments", 2026-09-26.

## D-012 · Keys: one PRF salt per role, Mera's canonical path within each · 2026-09-26 · accepted
**Context:** E-002 verified two ways to get several keys from one passkey: separate PRF salts, or BIP-44 indices from one PRF output. The Mera bounty text (#5) is still missing, and M1 needs real addresses now.
**Decision:**

- Owner key: PRF salt `sha256("curb.owner.v1")`. Trading key: PRF salt `sha256("curb.trade.v1")`.
- Within each salt, Mera's recipe applies: PRF output → BIP-39 → BIP-32 `m/44'/60'/0'/0/0`.
- Creating an account costs two biometric prompts; signing in costs two; every owner-key action costs one.

**Alternatives:** Indices 0 and 1 from one PRF output need one prompt, but deriving the trading key then makes the owner key derivable in the same moment. That contradicts the thesis.
**Consequences:**

- Changing either salt changes every address, so these strings are now permanent.
- The trading key never needs owner material. Each role's key can be exported as a standard mnemonic.
- Revisit only if the Mera bounty requires something else.

**Evidence:** E-002, E-004; web/src/lib/passkey/keys.ts.


## D-013 · The board is the approved comp for the look; the brief keeps the meanings · 2026-09-27 · accepted
**Context:** The user judged the first UI "terribly bad" and asked for a redesign that leverages the concept board and the Impeccable pipeline. This supersedes D-011 amendment 7 ("mood reference only") for visual polish only; the board is still never published.
**Decision:**

- The board's first Trade phone (`.impeccable/mocks/trade-comp.png`, gitignored) is the approved comp: layered panels, curb photograph behind a stencil price, pills, line icons, tab bar. User's words: "Comp-first from my board" and "Board's look, brief's meanings".
- The board's numbers and colours don't bind. User's words: "The board's placeholder numbers don't bind: always show real live data at full precision. Its yellow and green on prices, the live dot and the Buy button don't bind either: my brief's colour meanings win." So prices show 6 decimals from Kuru; ask, bid, Buy and the live dot are road white.
- Button colour rule: yellow only when a Face ID (owner-key) prompt happens now; white for trading-key actions and navigation. Selection (active tab, filter pill) is road white.
- The hero plate is a Higgsfield (nano_banana_pro) generation from the board's photo region, approved by the user; provenance is embedded in `web/public/plates/curb-photo.png`.
- In the hero, the book side the draft joins is drawn larger (26px vs 21px): the price the BUY/SELL bar quotes.

**Alternatives:** Keep the board as mood only (the user rejected the result); copy it literally (breaks the brief's key colours and would show fake numbers).
**Consequences:** The Impeccable hero gate stays formally open at 81%: the only controls below its bar (live pill, Buy bar) differ by the waived colours, and `--force` refuses a colour-only waiver. Disclosed in the PR.
**Evidence:** E-006; `.impeccable/surfaces/web-src-app-page-tsx.md`.

## D-014 · Production domain is curb-jet.vercel.app, permanently · 2026-09-27 · accepted
**Context:** Passkeys bind to the serving hostname (`rp.id = location.hostname`, docs/CONTEXT.md). The user approved the first deploy (#6).
**Decision:** Vercel project `curb` (team emmanuel-pauls-projects), root `web/`, framework pinned in `web/vercel.json`. Its production alias https://curb-jet.vercel.app is the one domain for the phone check (D-010), the demo and judging. Preview URLs are never used for passkeys.
**Alternatives:** A custom domain (costs money and needs the user's go-ahead); preview URLs (each one orphans every passkey made on it).
**Consequences:** Renaming the project or moving domains orphans every passkey created on this one, so a change needs a new decision and a sign-in plan. The deploy is run by the user (production deploys need their explicit permission here).
**Evidence:** E-007.

## D-015 · Signal green: live and confirmed onchain · 2026-09-27 · accepted
**Context:** After seeing the build, the user asked why it isn't as colourful as the board. Options offered: add a live green, board colours in full, or keep as is. The user chose the recommended live green. This amends D-013 (the live dot was road white) and D-011 amendment 6 (four canonical colours).
**Decision:** A fourth paint, signal green `#2bd47d` (P3 `color(display-p3 0.33 0.82 0.52)`), token `--live`. It marks only what the chain says is live or done: the block-stream dot and its "Live" word, the live pill's border while blocks arrive, a confirmed transaction, the "Allowed" verdict, the lane preview's live dot. Never prices, gains, selection or local success. Yellow and red keep their single jobs, so the owner-key and refusal moments stay loud and rare.
**Alternatives:** Board colours in full (yellow prices and BUY, red/green book) would blur "yellow = owner key" and make the refusal red ordinary, and the board's green change figure needs a 24h price source that doesn't exist yet. Keeping it as is did not answer the user's question of why the build is less colourful than the board.
**Consequences:** DESIGN.md, `.impeccable/design.json` and PRODUCT.md carry the new rule. Offline is a hollow grey ring, never red.
**Evidence:** E-008.

## D-016 · Production deploys from GitHub on merge to main · 2026-09-27 · accepted
**Context:** Each production deploy needed the user to run `vercel deploy --prod` by hand; the user asked for deploys to follow the repo instead.
**Decision:** The Vercel project `curb` is connected to github.com/emmanuelist/curb (root directory `web`, framework Next.js, production branch `main`). Every merge to `main` deploys https://curb-jet.vercel.app; every PR branch gets a preview deployment. `web/vercel.json` skips a build when a commit leaves `web/` untouched (`ignoreCommand: git diff --quiet HEAD^ HEAD -- .`).
**Alternatives:** A GitHub Actions deploy with a Vercel token (a secret to create and rotate, more moving parts); keep manual CLI deploys (the user's time, and production drifts behind `main`).
**Consequences:** "Merge only on green CI" now also gates production. Preview URLs are never used for passkeys (D-014). A manual CLI deploy, if ever needed, must run from the repo root, because the project's root directory is `web`.
**Evidence:** E-012.

## D-017 · CurbAccount: two roles, one lane, created per owner by a CREATE2 factory · 2026-09-28 · accepted
**Context:** M2's core claim must hold onchain (D-004): the trading key can't withdraw, and can't trade off Kuru's live book. M0 proved a contract can own Kuru margin and orders (E-001).
**Decision:**

- `CurbAccount` owns its Kuru margin and orders. **Owner** (passkey key A): `withdraw` from margin to any address, `sweep`, `setTrader` (address(0) revokes), `setMarket`, `cancel`. **Trader** (passkey key B): `placeBuy` / `placeSell` on allowlisted markets, and `cancel`. Nothing else.
- Every placement checks the price against Kuru's `bestBidAsk()` in the same transaction, with the exact rule of `web/src/lib/lane.ts`: maxBuy = ask × 1.005 floored to a tick, minSell = bid × 0.995 ceiled to a tick; a 0 or 2^256−1 sentinel on either side, or a crossed book, has no lane. Shared fixtures in `CurbLane.t.sol` and `lane.test.ts` prove the two agree.
- Custom errors the app decodes into its Refused state: `NotOwner`, `NotTrader`, `NotOwnerOrTrader`, `MarketNotAllowed`, `NoMarket`, `OffLane(isBuy, price, limit)`, `NotOnTick`, `ZeroPrice`.
- `CurbFactory.create(trader)` deploys the caller's account with CREATE2, salt = owner, so `accountOf(owner, trader)` recomputes the address from the passkey's two keys alone. One account per owner.
- Deposits need no account function: the owner credits the account directly with `MarginAccount.deposit(account, token, amount)` (native MON is `address(0)` with `msg.value`; verified on a fork).

**Alternatives:** EIP-7702 delegation (rejected in D-004); minimal-proxy clones (cheaper per account, but an initializer adds a front-running surface for ~0.1 MON of savings); a per-owner deploy without a factory (the address would depend on the owner's nonce, so recovery would need a search).
**Consequences:**

- **The lane bounds price, not frequency.** A stolen trading key can never withdraw, but it could churn trades at up to 0.5% off Kuru's best price each time. Disclose this in the README limits; a volume cap is a later option.
- A second `create` for the same owner collides and burns most of its gas limit (Monad charges the limit): the app must check for code at `accountOf` first.
- Gas under Monad rules (fork): `create` 1,181,268; `placeSell` 326,161; `cancel` 177,099. The app sets explicit limits just above these.

**Evidence:** E-015.

## D-018 · Orders and History come from a device ledger checked against the chain · 2026-09-28 · accepted
**Context:** #32 planned Orders and History "from Kuru events for the account". Kuru's events carry no indexed fields (so no topic filter by account), and the public RPC serves `eth_getLogs` over at most 100 blocks (~40 s). Kuru clears a cancelled order's slot, and usually a filled one's the same way, so after the fact `s_orders` can't always say which happened.
**Decision:**

- The app keeps a per-device ledger (`localStorage`, public data only: hashes, prices, sizes, order ids) of the transactions it sent: created, deposit, order, cancel. Every status shown is read from Monad: `s_orders` for each tracked id; receipts for the resting id, taker fills and the ids a cancel really removed.
- While an order rests, each refresh scans the new blocks' Kuru logs (≤ 100) for this account as **maker** and records fills with the taker's tx hash. An order whose slot still names the account with size 0 is filled (a cancel never leaves that). An order gone with no fill or cancel seen here reads "Left the book", with a note saying why.
- The trading key unlocks once per tab (one Face ID), stays in memory only, and locks on Lock, reload, or 15 minutes unused. Orders and cancels sign with no prompt while it is unlocked.
- Deposits are MON only in #32. A buy is funded by the USDC a sell leaves in the account. A USDC deposit (approve + deposit, two owner-key transactions) is deferred, not dropped.

**Alternatives:** an indexer or backend (breaks rule 1's "the chain is the only store" and adds a service to run); paging `eth_getLogs` 100 blocks at a time from each placement (thousands of calls per day of history on the public RPC); CurbAccount events (it emits `OrderSent`, but that says nothing about fills or cancels).
**Consequences:** another device signed in with the same passkey sees none of this device's history, and a cancel from there shows here as "Left the book". Known fills are only those seen while Curb was open, plus fills on arrival. README limits must say so.
**Evidence:** E-017.

## D-019 · Refusals are proven onchain, read back from the chain, and can't turn into trades · 2026-10-03 · accepted
**Context:** #33 makes the thesis visible: the trading key can't withdraw, and can't trade off the lane. A refusal has to happen onchain (a tx anyone can open), its reason must come from the chain rather than the app's guess, and a "proof" must never become a real order or a real withdrawal by accident. Monad charges the full gas limit, even on a revert.
**Decision:**

- **Proof actions** (trading key, no prompt): "Try a withdrawal with this key" on Keys (asks the account for its MON, sent to the trading key itself) and "Send it anyway" under an off-lane ticket. Each is **dry-run first** (`eth_call` from the trading key at the latest block) and sent only if the dry run shows one of CurbAccount's own refusals; otherwise nothing is sent and the screen says why.
- The off-lane proof goes **post-only**: if the lane moved and the account let it through, Kuru refuses a crossing post-only order (`PostOnlyError`), so it can't take liquidity. The rare remainder (the book moved far enough that it no longer crosses) rests as a normal order the app records and offers to cancel.
- **Tight gas limits**, measured on a fork: 40,000 for the withdrawal attempt (22,930 used), 220,000 for the off-lane order (172,826 used), about 0.004 and 0.022 MON at 102 gwei.
- **The reason shown is the chain's**: the revert data comes from `debug_traceTransaction` (callTracer) on the mined tx and is decoded against CurbAccount's and Kuru's errors. If the node won't trace, the screen says the reason is from the dry run of the same call.
- **Owner money out** (Face ID): withdraw MON or USDC from the account's Kuru margin to the owner key or any address; send MON from the owner key to the trading key or any address. A destination with code gets the node's gas estimate + 25%; a plain address gets the measured limit. A transfer that leaves the owner key under Monad's 10 MON reserve waits until the key has sent nothing for 3 blocks.

**Alternatives:** simulate-only refusals (no tx, nothing for a judge to open); the stencil sign with the app's own reason (could disagree with the chain); a separate "proofs" screen (the refusal belongs where the action is: the ticket and the trading key).
**Consequences:** every proof costs real gas and is labelled with its cost before the tap. Withdrawals can't touch margin held by open orders; the form says to cancel first.
**Evidence:** E-018.

## D-020 · M2 closes without a separate order preview, transaction details screen or custom owner sheet · 2026-10-03 · accepted
**Context:** PLAN's M2 row lists BRIEF phases 3–5, including an order preview / lane-lock confirmation, a Transaction details screen and an owner Face ID sheet. M2's mainnet exit (E-019) passed without them, and M3 (README proof surface, latency, demo video) is what judges see first, with 10 days left.
**Decision:** cut all three, and say so.

- **Order preview / lane-lock:** the ticket already draws the order on the live lane ("Your buy" between the curbs, the hint line, the hatched off-book state) before anything is sent, and the account re-checks the lane onchain in the same transaction. A confirm step would put a prompt in front of the key whose point is having none.
- **Transaction details:** every transaction links to Monadscan, the canonical detail view. Refusals already show their decoded reason, signer, gas and hash in the app.
- **Owner Face ID sheet:** the system Face ID sheet is the sheet. Every owner action names its signer in yellow before the tap.

**Alternatives:** build them (about 1–2 days that M3 needs).
**Consequences:** PLAN's M2 line reads with this cut. If time remains after M4's preflight, the order preview is the first to revisit.
**Evidence:** E-019.

## D-021 · Go for every bounty Curb can be built to win, Agora included, through a Perpl lane · 2026-10-03 · accepted
**Context:** the bounty texts (#5) showed Agora's $10k needs an AUSD balance and trades through Perpl; Curb trades spot on Kuru. The user's direction: "I don't want us to limit ourselves to time. If we can build it to win us and we have what it takes then we do that." The user also can't recruit outside traders.
**Decision:**

- Targets: Track 1, Kuru (Next Consumer Trading App), Mera (Best Mera-Powered UX), and Agora (Best Mobile Trading App) through **CurbAccount v2**. The same two keys, AUSD as collateral on Perpl, and the trading key held to Perpl's live best bid/ask plus an owner-set leverage cap, all enforced onchain. Perpl's book is onchain, which is what makes this possible (E-020).
- Mera "One Passkey, Many Keys" only with a non-account idea that could win, since the bounty excludes wallet keys.
- Kuru's evidence of demand comes from research and onchain data (#46), never presented as outside users.

**Alternatives:** stay with Track 1 + Kuru + Mera UX (less work, $10k left on the table); build Perpl trading outside the account (an unguarded key, which contradicts the thesis).
**Consequences:** a new factory and a new account per user (v2); the thesis generalises to "can't trade off the live order book" on two venues. Order of work: v2 contract and fork tests (#49), then the factory deploy (#50, needs the user's go-ahead), the futures screen (#51), the stateless rebuild (#40), then the proof surface. Agora's "mobile application" wording is being asked of the sponsor (#52).
**Evidence:** E-020.

## D-022 · The sell curb is the exact bid × (1 − band), rounded up · 2026-10-03 · accepted
**Context:** D-017 says "minSell = bid × 0.995 ceiled to a tick". The app and CurbAccount v1 computed it by rounding the product down first and then up to a tick, which can land one tick low: bid 0.026399 gives 0.026267, below the exact 0.0262670050. The Perpl lane (tick 1) exposed the gap, because its shared fixture disagreed with the contract by one unit.
**Decision:** minSell = ceil(bid × (BPS − band) / BPS), then up to a tick, in `web/src/lib/lane.ts` and both lanes of CurbAccount v2 (Kuru and Perpl). maxBuy is unchanged (round down). New shared fixtures: Kuru bid 0.026399 → 0.026268; Perpl bid 0.033284 / ask 0.033376 → 0.033118 / 0.033542.
**Alternatives:** keep floor-then-ceil everywhere (consistent, but a sell could sit a hair under the stated curb).
**Consequences:** v1 accounts (only the builder's, empty) keep the old rounding; the app's rule is never looser than either version. Supersedes D-017's rounding detail only.
**Evidence:** E-022 (CurbLaneTest 14/14, lane.test.ts).

## D-023 · Futures in the app: MON perp only, read by a deployless reader, hidden until v2 is live · 2026-10-03 · accepted
**Context:** #51 brings Agora's Perpl and AUSD into the app (D-021) on top of CurbAccount v2 (E-021).
**Decision:**

- One perpetual: MON (Perpl id 10), cap 5× by default, leverage choices 1/2/3/5/10× with anything over the cap drawn past a curb. A refusal for leverage signs as "MAX 5X".
- Perpl's book is read in one `eth_call` by `PerplBookReader` run as deployless bytecode (viem `call({ code })`): nothing deployed, no backend, values straight from the chain. The lane comes from `getPerpetualInfo`, the same source the contract checks.
- AUSD in is two owner-key transactions under one Face ID (to the account, then `perplDeposit`); out goes to the owner key or any address.
- The Perpl market is hidden while the app points at the v1 factory, so nobody is led to an account that can't trade futures. It appears when #50's factory is live.
- Fork tests of taker flows freeze block timestamps, because a fork otherwise ages Perpl's oracle past its 60-second limit.

**Alternatives:** Perpl's REST API for depth (offchain data, breaks rule 1); several perpetuals (more surface, no extra proof).
**Consequences:** a taking order that walks many levels may need more than the 450,000 gas limit; the app shows the refusal if it runs out. The demo uses one level.
**Evidence:** E-022.

## D-024 · The leverage cap is a curb: drawn as one, and a refusal returns the ticket to it · 2026-10-04 · accepted
**Context:** #51's finish review found the over-cap ticket contradicting itself after a refusal: "the contract would refuse 10×" and the proof box stayed beside a card saying the account had refused it. The lane already avoids this, because an off-lane refusal returns the ticket to the curb (BRIEF §11) and its warning goes with it.
**Decision:** treat the cap the same way. `LeverageAboveCap` carries the cap it enforced; the ticket returns to it, and the card says "Your ticket is back at your cap, 5×." In the leverage row the cap is drawn as a curb: the lane's double white line, once, between the last choice under the cap and the first past it.
**Alternatives:** hide the warning and the proof box while the card shows (the reviewer's proposal). The ticket would stay unsendable, and spot and perp would behave differently after a refusal.
**Consequences:** after a cap refusal the order can be sent at the cap with one tap.
**Evidence:** E-023.

## D-025 · Perpl orders are tracked by transaction, not by order id · 2026-10-04 · accepted
**Context:** Perpl reuses order ids: 2^16−1 slots, and a freed id is handed straight out again. On a fork, three successive orders from one account were all #35. The ledger and the position card matched cancels to orders by id, so a new order that reused a cancelled id read as cancelled and disappeared.
**Decision:**

- A cancel or a fill belongs to the latest earlier order with that id. An order whose id a later order of ours took has left the book.
- Reading the book checks the slot's account, side and price before calling the order ours.
- Fills of resting orders are found by scanning Perpl's logs for `MakerOrderFilled(V2)` with our account and order id, as Kuru's are (D-018).
- Orders lists Perpl orders beside Kuru's, with one row grammar.

**Alternatives:**

- Perpl's `orderDescId`: a client id that appears only in events, not on the stored order, so the book can't be read by it.
- An indexer: a backend, which breaks rule 1.

**Consequences:** a fill could be credited to the wrong order if the filled id is reused before the app sees the fill: both inside one ~5-block refresh while resting, or one 100-block scan window. #40's rebuild from the chain settles it.
**Evidence:** E-023.

## D-026 · Funding futures from MON goes through Kuru Flow, checked before Face ID · 2026-10-04 · accepted
**Context:** the owner key lives in the passkey, so it can't connect to a DEX, and someone funding from an exchange arrives with MON. Agora's bounty is judged on UX and on "creative use of the three integrations together", and asks for "funding or viewing an AUSD balance" (#56).
**Decision:**

- The AUSD card's Get tab swaps MON on the owner key for AUSD with Face ID, routed by Kuru Flow (Kuru's aggregator). Its API returns a quote and a transaction for its router, `KuruFlowEntrypoint` `0xb3e6…13cb`.
- The quote is Kuru's offchain estimate and is labelled as one, an exception to rule 1 that applies only to this estimate. What counts is onchain: the minimum written into the transaction, and the AUSD the receipt shows arriving.
- Before Face ID, the app decodes the transaction. It signs only `executeSwap` on the pinned router (or `executeSwapWithReceiver` paying the owner key itself) that:
  - sells exactly the chosen MON for AUSD;
  - carries an onchain minimum no lower than the quote's;
  - pays at most a 0.5% fee.
  Then it dry-runs the swap; a stale price fails here and nothing is signed.
- Max leaves Monad's 10 MON reserve and 0.5 MON for gas on the owner key.

**Alternatives:**

- Uniswap v4's MON/AUSD pools directly, quoted fully onchain. The 1% pool gave 14.48 AUSD for 450 MON against Kuru Flow's 15.23 (about 5% less); the 0.01% pool is empty.
- Accepting only AUSD sent from outside: that needs a second wallet.

**Consequences:**

- The app depends on Kuru Flow's API for routes, at one quote a second per token. If it is down, Get says so, and AUSD can still arrive from outside.
- A price that moves past the minimum between dry run and block reverts the swap; only gas is spent.

**Evidence:** E-026.

## D-027 · Kuru Flow picks the route; Monad prices it · 2026-10-04 · accepted
**Context:** the first mainnet swap from the user's phone (354.08 MON) was refused before Face ID. Kuru Flow's quotes ran about 1% above what their routes paid onchain, which put the payout below even the minimum Kuru wrote into the transaction, so the router would revert `KuruFlowEntrypoint_InsufficientAmountAfterFees()` (`0x5264a63f`). This supersedes D-026's "an onchain minimum no lower than the quote's".
**Decision:** after checking the quote's transaction (router, function, tokens, amount, receiver, fee), the app simulates the route from the owner key with no minimum. What the route pays is shown as "You get about", and the swap's minimum is set 0.5% under it. Kuru Flow's own estimate is kept only for comparison.
**Alternatives:**

- A fixed 1.5–2% slippage on Kuru's quote: a looser floor than needed, and it still fails when the gap grows.
- Uniswap v4 directly: a worse price (D-026).

**Consequences:** the number on screen comes from Monad, not from Kuru, at the cost of one extra `eth_call` per quote. A move of more than 0.5% between the dry run and the block still reverts the swap, costing only gas.
**Evidence:** E-027.

## D-028 · A one-tap close walks the book inside the lane, with a measured gas limit · 2026-10-04 · accepted
**Context:** "Close at {best bid}" sent an immediate order at exactly the top level with a fixed 450,000 gas limit. A thin top level leaves part of the position open: on 2026-10-04 Perpl's best bid held 79 MON, and two fork tests failed this way. A close that walks levels can also need more gas than 450,000; one two-level close used 615,930 on a fork.
**Decision:**

- The close is priced at the lane's far curb: min sell for a long, max buy for a short. That is the worst it may get, still inside the lane, so it can walk levels; Perpl fills at each resting order's own price. The button says "Close now · no worse than X".
- Taking orders (the close and the ticket's) get a measured gas limit: a dry run from the trading key plus a fifth. The fixed limit applies only when the dry run fails.
- History records the size-weighted average fill price from the receipt's maker fills. Partial fills are reported as partial.

**Alternatives:**

- Close at the best bid and retry the remainder: several transactions and prompts.
- A fixed higher gas limit: Monad charges the whole limit on every close.

**Consequences:** in a thin book a close may fill well below the top bid, but never below the curb. Gas is paid on what the route needs plus 20%.
**Evidence:** E-029.

## D-029 · Orders and History are read from the chain; the device's ledger is a cache · 2026-10-04 · accepted
**Context:** the Mera UX bounty's stateless test: judges clear local storage or open the app on a fresh device mid-demo, and identity and access must fully reconstruct from the passkey. Keys, the account and balances already did. Orders and History came from a per-device ledger (D-018), so a fresh device showed neither. Kuru's and Perpl's events aren't indexed by account, and the public RPC serves `eth_getLogs` over 100 blocks at a time.
**Decision:** supersedes D-018's per-device scope.

- When Orders or History opens, the app finds every transaction the owner and trading keys sent since the account was created and decodes each into the entry the device would have written.
- The account's creation block comes from a parallel search on its code. Each transaction comes from a parallel search on the key's historical nonces, all nonces narrowed together, as JSON-RPC batches.
- A resting order that left the book with no cancel from either key is traced to the block it left in, by a search on its slot; that block's logs give the fill.
- A sync marker records how far the device matches the chain, so later visits read only what's new. Progress and elapsed time are shown while it runs.

**Alternatives:**

- Scanning logs per 100 blocks over the account's whole life: cost grows with age, not with activity.
- An indexer: a backend, which breaks rule 1.

**Consequences:**

- A first read takes about 20 s for a few transactions on the public RPC; later visits take about 1 s.
- Fills of an order that filled in parts are found only for its last part.
- The public RPC may not serve state far in the past.

**Evidence:** E-030.

## D-030 · One passkey ceremony makes both keys; owner actions still prompt alone · 2026-10-04 · accepted
**Context:** Mera's UX bounty asks for "one-prompt onboarding: a single passkey ceremony" and judges time to first transaction. Onboarding took two ceremonies or three, one per key (D-012's separate PRF salts), and sign-in took two. Mera's API evaluates one salt per ceremony, but it accepts a custom `webAuthnClient`, and WebAuthn's PRF extension evaluates two salts (`first`, `second`) in one ceremony.
**Decision:** onboarding and sign-in use a Mera `webAuthnClient` (`web/src/lib/passkey/dual-salt.ts`) that mirrors Mera's browser client and adds the other key's salt as `second`. Mera receives the first output as usual; the second derives the other key.

- Creating a passkey is one ceremony where the authenticator evaluates PRF at creation, and two where it doesn't.
- Signing in is one ceremony.
- Unlocking the trading key and every owner action keep their own single-salt ceremony. The trading session never holds owner material, and each owner action still asks for Face ID.

**Alternatives:**

- Derive both keys from one salt: unlocking trading would then hold the owner key's secret (rejected under D-012).
- Bypass Mera for the ceremony: the bounty is for Mera-powered UX.

**Consequences:** Curb now runs its own copy of Mera's browser client, so a Mera update must be checked against it. Funding, the slow step, now shows the owner address and watches for MON in the create step itself.
**Evidence:** E-032.

## D-031 · The trading session locks after 15 minutes unused, checked again whenever the key is used · 2026-10-04 · accepted
**Context:** Mera's UX bounty judges "session design — sensible scoping of prompt-free vs. re-prompt actions, clean session-expiry UX" (#42). The trading key already locked after 15 minutes unused, but only on a timer, and the app said so in one sentence. A phone asleep in a pocket can hold a timer back, so on waking, a key that should be gone could still sign for a moment.
**Decision:** a session ends on whichever comes first: 15 minutes without the key being used, a tap on Lock, or leaving the page. Every use of the key pushes the 15 minutes back.

- The deadline is checked in three places: when the timer fires, when the page becomes visible again, and when the key is about to sign. A key past its deadline is never handed out.
- The unlock step states the scope: places and cancels inside the lane with no prompt, can never withdraw, because the account refuses that onchain.
- While unlocked, every ticket state and Orders show the time left and a Lock button. After a timeout the same row says why the key locked.
- Owner actions keep their own Face ID (D-030).

**Alternatives:**

- A fixed lifetime from unlock: it would lock someone in the middle of trading, and an idle key would still be live for the whole lifetime.
- A prompt for every order: that undoes the product. What limits the key is what the account enforces onchain, not how often it prompts.

**Consequences:** The countdown re-renders once a second while unlocked, only in the rows that show it.
**Evidence:** E-034.

## D-032 · Only the Curb account refuses; a venue rejects · 2026-10-04 · accepted
**Context:** The polish pass (#47) found Perpl's own rejection of an order (`TakerOrderSettlementFailed`) drawn as the account's red refusal plate, and filed in History's Refusals tab. DESIGN.md binds stop red to "a refusal made onchain by the Curb account", and the product's claim rests on that red meaning exactly one thing.
**Decision:** a transaction is classed by its error's name (`refusedBy` in `web/src/lib/curb/refusal.ts`).

- **The account's own error** (`OffLane`, `NotOwner`, `LeverageAboveCap`, …): the red plate, and History's Refusals tab.
- **Kuru's or Perpl's error:** a neutral panel, "Perpl rejected it." It adds that the account allowed it, which is always true, since the account's checks run before the venue is called. History lists it as "Rejected by Perpl" under Trades (or Transfers for a withdrawal).
- **No readable reason:** "It reverted onchain." It makes no claim about who refused.

**Alternatives:** red for every revert. That makes red mean "failed", and the claim's proof, Curb refusing onchain, would share its colour with a venue's hiccup.
**Consequences:** History's Refusals tab now holds only Curb's refusals. A rejection recorded before this change reclassifies from its stored error name, with no migration.
**Evidence:** E-035.

## D-033 · A one-tap close keeps 0.10% inside the curb (supersedes D-028's price) · 2026-10-04 · accepted
**Context:** D-028 priced "Close now" exactly at the far curb (min sell for a long), the worst price the lane allows. On mainnet the user's close of a 1 MON long was refused (`PerpOffLane`, tx `0xa05bd67c…4518f1`). The app read the curb as 0.033334; by the block the close landed in, the bid had risen and the curb was 0.033340. The rule worked, but a close shouldn't fail because the market moved in the trader's favour, and the refusal cost 0.0459 MON of gas.
**Decision:** the close is priced 0.10% of the touch inside the far curb: min sell + ceil(bid × 10 bps) for a long, max buy − floor(ask × 10 bps) for a short. It never goes past the touch (`closePrice` in `web/src/lib/curb/perp.ts`). For the refused close that is 34 ticks of headroom against the 6-tick move that refused it. The close still walks most of the lane (0.40% of the 0.50%), and D-028's measured gas limit is unchanged.
**Alternatives:**

- Retry after a refusal: that costs a second transaction and more gas.
- Price at the touch: that walks nothing, so a thin top level would leave part of the position open (the reason for D-028).

**Consequences:** "Close now · no worse than X" shows the new price. A move of more than 0.10% between reading the book and landing can still refuse a close, and the refusal says so.
**Evidence:** unit tests on the mainnet case; the refusal above (E-038).
