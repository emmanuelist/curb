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
