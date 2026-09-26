# Issues

Temporary. Move these to GitHub issues once the remote exists, and delete this file in the same commit.

## M0 · Spikes (due 2026-09-28)

### #1 · Spike: CurbAccount trades on Kuru through a mainnet fork · `type:spike` `p0`

**Why:** D-004. The whole design assumes a contract can own Kuru orders and margin.
**Acceptance**

- [ ] `forge test --fork-url $MONAD_RPC_URL` passes with a minimal account contract that deposits USDC into MarginAccount, places a buy order on MON-USDC inside the book, reads it via `s_orders`, cancels it, and withdraws.
- [ ] `getMarketParams()` field order and `bestBidAsk()` scaling confirmed; docs/CONTEXT.md updated.

**Evidence:** forge test output (EVIDENCE entry).
**Out of scope:** the price check and key roles (M2).

### #2 · Spike: one passkey, two keys, a signed tx · `type:spike` `p0`

**Why:** the "many keys" mechanism (Mera PRF with two salts) and the Mera → viem path.
**Acceptance**

- [ ] In headless Chromium with a CDP virtual authenticator (PRF enabled), `createPasskeyWithPrfOutput` plus `getPasskeyPrfOutput` with two salts produce two different 32-byte outputs, hence two different EVM addresses.
- [ ] `toViemAccount` signs a tx that an anvil fork of mainnet accepts.
- [x] How Mera turns a PRF output into a private key is recorded in CONTEXT (done 2026-09-26 from the captured recipe: BIP-39 → BIP-32 m/44'/60'/0'/0/i).

**Evidence:** script output + fork tx hash.
**Out of scope:** UI.

### #3a · Check: PRF works on the user's iPhone · `type:spike` `p0` · **DONE 2026-09-26**

**Why:** D-008. Judges will use real phones; the virtual authenticator can't prove device support.
**Acceptance:** [ ] On the user's iPhone (iOS 18.7.9, Safari), Mera's live demo https://mera.category.xyz/demo/index.html creates a passkey account and shows an EVM address.
**Evidence:** the user's confirmation plus a screenshot (no secrets on screen). Needs about one minute of the user's time and no funds.
**Attempt 1 (2026-09-26): failed.** The page was opened in Telegram's in-app browser: "The passkey request was cancelled or failed", 0 passkeys saved. Retry in Safari itself (see CONTEXT → Traps).
**Attempt 2 (2026-09-26): passed.** In Safari, the account was created, the address `0x6Fa0…6e4a` was shown and the demo balance loaded. Screenshots: internal/research/raw/mera-demo-iphone-{telegram-inapp-FAIL,safari-OK}-2026-09-26.png.

### #3b · Spike: one real mainnet tx from a Mera-derived key · `type:spike` `p1`

**Why:** proves a Mera-derived key is accepted on chain 143 end to end.
**Blocked on:** the user's go-ahead plus about $2 of MON sent to the derived address (CLAUDE.md rule 6).
**Acceptance:** [ ] a Mera-derived address sends one tx on chain 143.
**Evidence:** explorer link.

### #4 · Capture bounty requirements verbatim · `type:proof` `p0`

**Why:** bounties are judged 40% on adherence (Rules §5.2).
**Blocked on:** user pastes the texts: Kuru "Next Consumer Trading App", Mera "Best Mera-Powered UX", Mera "One Passkey, Many Keys", Agora "Best Mobile Trading App".
**Acceptance:** [ ] texts saved to `internal/bounties/`; each requirement mapped to an M2/M3 acceptance line.

## Later milestones (placeholders, detailed when their milestone starts)

- **M1 · Walking skeleton:** scaffold web/ and contracts/, CI, design direction, deploy, Face ID → one mainnet tx from the deployed URL.
- **M2 · Core claim:** CurbAccount (owner/trader roles, market allowlist, onchain book check), deploy + verify, trading screen, refusal paths shown onchain.
- **M3 · Proof surface:** README proof section, EVIDENCE complete, latency measurement, demo video (real footage → Remotion edit → ElevenLabs narration, ≤ 3:00; D-007).
- **M4 · Submit:** preflight, submission form in Track 1, bounties selected.
