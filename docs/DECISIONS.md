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
