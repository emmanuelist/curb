# Evidence

Append-only proof log. Every claim in the README, demo or submission points to an entry here. Proof is a public link (explorer, deployed URL, CI run) or a command plus its captured output.

| # | Date | Claim | Proof | Commit |
|---|---|---|---|---|
| E-001 | 2026-09-26 | A contract can own Kuru margin and resting orders on MON-USDC: deposit → place → cancel → withdraw with nothing lost (fork of Monad mainnet, block 108,236,646) | `MONAD_RPC_URL=https://rpc.monad.xyz forge test --match-contract KuruForkTest -vv` (output below) | e6fee9b |

### E-001 output

```text
Solc 0.8.30 finished in 1.01s
Compiler run successful!

Ran 1 test for test/KuruFork.t.sol:KuruForkTest
[PASS] test_contractOwnsKuruOrders_roundTrip() (gas: 277684)
Logs:
  block 108236646
  pricePrecision 100000000
  sizePrecision 10000000000
  baseDecimals 18
  quoteDecimals 6
  tickSize 100
  minSize 2000000000000
  margin balance after deposit 50000000
  bestBid (raw) 26701000000000000
  bestAsk (raw) 26711000000000000
  orderId before/after 109573632 109573633
  margin balance with order resting 44659600

Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 13.53s (9.76s CPU time)

Ran 1 test suite in 13.54s (13.53s CPU time): 1 tests passed, 0 failed, 0 skipped (1 total tests)
```

The resting buy locked exactly price × size: 0.026702 USDC × 200 MON = 5.3404 USDC (50 → 44.6596).

| E-002 | 2026-09-26 | One passkey yields two distinct, reproducible EVM keys (owner/trading) via Mera PRF salts, and the trading key signs a tx with zero passkey prompts (anvil fork of Monad mainnet) | `spikes/passkey`: `window.runSpike()` driven by Playwright in Chromium 154 with a CDP virtual authenticator (`hasPrf: true`); output below | 6ad701a |

### E-002 output (virtual authenticator; fork tx, not a real mainnet tx)

```json
{"authenticatorCredentials":1,
 "result":{"rpId":"localhost","prfOutputBytes":[32,32,32],
  "approachA_separateSalts":{"owner":"0xF8892B015A2207Fe1C11805da7423b6D663D3910","trade":"0xDe0eD293861B5FaeDC3670059FddCA5118516bcB","distinct":true,"tradeDeterministic":true},
  "approachB_indices":{"owner":"0xdf640201e0229a5D05fEB6aC7F6BDe3071631a02","trade":"0x798bF6518CA9f57e42F0663d78bcEE82579bD642","distinct":true},
  "createTimePrfEqualsDefaultSaltPrf":true,
  "forkTx":{"from":"0xDe0eD293861B5FaeDC3670059FddCA5118516bcB","to":"0xF8892B015A2207Fe1C11805da7423b6D663D3910","hash":"0x061a3ac16b869fca3b88023926cc7fc5277dca886bf365ed7765e9939f2aeb96","status":"success","block":"108237484","ownerBalanceWei":"10000000000000000"},
  "ceremonies":5,"ceremoniesDuringSigning":0}}
```

| E-003 | 2026-09-26 | The Trade screen runs on live Monad and Kuru data: WebSocket block stream, a book read per ~2 blocks, the lane from `bestBidAsk()` ±0.50%. Lane dashes advance exactly once per real block. | Playwright on `next dev` against mainnet: blocks 108,278,665→108,278,670 (5 blocks) gave `--step` 3→8 (5 steps) in 1.5 s; no horizontal overflow at 390/768/1440; no app console errors | branch `6-m1-scaffold` |
| E-004 | 2026-09-26 | Onboarding and owner key, end to end on a Monad mainnet fork: one passkey creates owner and trading keys; the owner key (biometric) sends MON to the trading key; sign-in recovers the same addresses; the in-app guard blocks Telegram | Playwright + CDP virtual authenticator (`hasPrf`) + anvil fork (chain 143), output below | branch `6-m1-scaffold` |

### E-004 output (fork, not a real mainnet tx; the real one is M1's phone check, D-010)

```json
{"created":{"owner":"0x55b6b2A327e73b577B52483C56439078a47011de","trading":"0x7edDa0F21801a523Af9231aCbF66cD9138cF3752"},
 "fund":"ok",
 "tx":"0xd96ab165f06acd7a75cda82536ce38defa86090bdd5756c5666417705c644f85",
 "receipt":{"status":"0x1","from":"0x55b6…11de","to":"0x7edd…3752","gasUsed":"21000"},
 "tradingBalanceWei":"1000000000000000000",
 "signInSameAddresses":true,"inAppGuard":true,"createButtonHidden":true}
```

| E-005 | 2026-09-26 | CI green on both jobs: web (lint 0 warnings, typecheck, 17 tests, build) and contracts (fmt, build, Kuru fork test against the public Monad RPC) | [CI run 36271831598](https://github.com/emmanuelist/curb/actions/runs/36271831598) | PR #14 |

| E-006 | 2026-09-27 | The board redesign (D-013) renders every screen on live Monad and Kuru data with no horizontal overflow at 390 / 430 / 768 / 1280 / 1440; the off-lane draft lands in the hatched off-book zone and the ticket names the refusal; `impeccable detect` finds nothing; an independent finish review ended `ship` | Playwright captures on `next dev` against mainnet (docs/evidence/ui/: trade-mobile, trade-desktop, offlane-mobile, orders-mobile); Impeccable comp-diff hero 81% (every text region passes; live-pill and buy-bar drift only by the user's waived colours); reviewer passes: full review `fix` (8 items) → verdict `fix` (2 partial + stencil "4" misreading as a decimal point) → verdict `ship`; lint 0 warnings, typecheck, 17 tests, warning-free build | branch `16-board-redesign` |
| E-007 | 2026-09-27 | Curb is live on Monad mainnet data at https://curb-jet.vercel.app: all six routes return 200 and unknown paths a Next 404; the block stream advanced 10 blocks in 3 s with the lane dashes stepping exactly 10; the Kuru mid and lane curbs render; the curb plate loads through the image optimizer; /start runs in a secure context with WebAuthn available; zero console errors; no overflow at 390 or 1440 | curl per route; Playwright on production (block 108,367,253 → 108,367,263, `--step` 15 → 25); captures docs/evidence/ui/prod-trade-mobile.png, prod-trade-desktop.png | branch `6-vercel-deploy` |
| E-008 | 2026-09-27 | Signal green marks only live and confirmed-onchain state (D-015); the app has its own favicon, iPhone icon, installable manifest and share card (static, so no "live" claim on it); every stencil "4" is clean at the font level; 404 and error pages are in place and truthful | Playwright on `next dev` against mainnet: rendered head carries manifest, format-detection off, og/twitter 1200x630 image + alt, favicon.ico, icon.svg, apple-touch-icon; Trade tab title "0.026110 MON/USDC · Curb"; 404 title "No road here · Curb"; `@font-face` for the clean 4 limited to `unicode-range: U+34`; error.tsx rendered in a production build via a throwaway throwing route (deleted); build lists icon, apple-icon, manifest, opengraph and twitter images as static routes; lint 0 warnings, typecheck, 17 tests, warning-free build; `impeccable detect` 0 findings; independent review `fix` (4 items) acted on. Green "Confirmed" pill captured on an anvil fork of mainnet (chain 143) with the E-004 harness: virtual passkey creates the account, the owner key sends 1 MON to the trading key, tx `0x8b5dcb0ae170bd6f9b802e690bca53858cce1270286be04c4fbb04c7c88159a2` status 1 at fork block 108,375,438 (fork only; the real mainnet send stays the phone check, D-010) | branch `19-live-green-identity` |
| E-009 | 2026-09-27 | Production (https://curb-jet.vercel.app) serves the live green, identity and error work: favicon, apple-icon and share card are byte-identical to the repo; the manifest is standalone with a maskable icon; og/twitter tags use absolute production URLs; the tab title tracks the live mid; the live dot renders in P3 signal green while blocks stream; the 404 renders; across all six routes zero failed requests and zero console errors | curl per asset (sha256 match for favicon.ico, opengraph-image.png, apple-icon.png); Playwright on production: title 0.026255 → 0.026257 MON/USDC, blocks 108,378,638 → 108,378,648 in 3 s, dot `color(display-p3 0.33 0.82 0.52)`; capture docs/evidence/ui/prod-trade-mobile.png | branch `6-prod-identity-evidence` |
| E-010 | 2026-09-27 | Performance work (#22) with no change to what renders: phone Lighthouse on one local production harness went Performance 81–84 → 86, SEO 91 → 100, TBT 80 → 40–50 ms, unused JS 131 → 66 KiB, fonts 9 → 7, main-thread time 20–24 s → 10.6–14.2 s; with devtools (real) throttling Performance 96, LCP 2.5 s; steady-state main-thread load at 4x CPU 17.6–21.3 % → 13.8–14.6 %; the LCP photo now fetches at High as a 19 KiB AVIF (was 29 KiB WebP at Low); the home page loads no passkey code; passkey create, sign-in recovery and the Face ID send still pass on the mainnet fork | Lighthouse 12.8.2 `--form-factor=mobile` (simulated slow 4G, 4x CPU) x2–3 runs before/after on `next start`; CDP `Performance.getMetrics` over 10 s; E-004 fork harness: sign-in recovered the same addresses, send tx `0xa4069786a1dd8bc2b0e00f85bb86d4fecf68c9688a3c1a1b2f2e9c91088ded86` status 1 at fork block 108,391,372; home page script scan found 0 chunks with passkey code. Simulated LCP stays ~4.2 s (Lantern models the parallel script requests); an experiment dropping body-font preloads made FCP worse (0.8 → 1.2–2.0 s) and was reverted | branch `22-performance` |
| E-011 | 2026-09-27 | Production after the performance deploy: phone Lighthouse Performance 84 (was 78), SEO 100 (was 91), LCP 4.3–4.4 s (was 4.9), main-thread 10.6–11.5 s (was 21); the photo is served as a 19.9 KB AVIF. The live HTML showed the LCP photo still `loading="lazy"` (Next 16 default); with `loading="eager"` added, the local harness passes both LCP audits and the photo's load delay drops 1,323 → 57 ms (Performance 86 x3) | curl on https://curb-jet.vercel.app (routes 200, `image/avif` 19,935 B); Lighthouse 12.8.2 mobile on production x2 and locally x3 after the fix | branch `22-lcp-eager` |
| E-012 | 2026-09-27 | Production now deploys itself from GitHub (D-016): PR #25 got a Vercel preview check that had to pass before merge, and its merge to `main` built and aliased https://curb-jet.vercel.app with no manual step; that deploy carried #24's eager photo. Production Lighthouse (phone) scored 99 / 87 / 84 across three runs (LCP 1.8–4.5 s, network variance), both LCP audits passing; real throttling 92; desktop 99 | Vercel API for the deployment: `source: git`, `target: production`, commit `91a3434` (merge of #25), alias `curb-jet.vercel.app`; live HTML shows `loading="eager"`; Lighthouse 12.8.2 on production | branch `6-git-deploy-evidence` |
| E-013 | 2026-09-28 | **M1 exit (D-010):** on the user's iPhone, in Safari on https://curb-jet.vercel.app, a real passkey (Apple Passwords) created the Curb account, and the owner key signed a real Monad mainnet transaction with Face ID: 1 MON from the owner key to the trading key | tx [`0x72c21e7ea823d4beeddc4a2c9f5316ce7a295573a237ac85eb78fb2dba4a9ab4`](https://monadscan.com/tx/0x72c21e7ea823d4beeddc4a2c9f5316ce7a295573a237ac85eb78fb2dba4a9ab4): status 1, block 108,615,694, from owner `0x222Bc473153617Db03455Ab18C1cab8D6249037C` to trading `0x01e8a0919011a31E6C30a782A12496ddbbb523D1`, value 1.0 MON, 21,000 gas at 102 gwei; balances after: trading 1.0 MON, owner 3.997858 MON (`cast receipt`, `cast balance` on the public RPC); the user's screenshot shows the app's green Confirmed pill for the same hash. Funding came from the user's Binance Wallet (USDT on BNB Smart Chain bridged to MON on Monad via LiFi) | branch `6-m1-exit` |
| E-014 | 2026-09-28 | The contracts toolchain runs under Monad's own execution rules: Foundry 1.8.3 with `network = "monad"` and the `osaka` target that Monad's docs require; E-001's Kuru round trip (deposit, place, cancel, withdraw from a contract) passes that way on a mainnet fork | `forge build --force` (artifact `evmVersion: osaka`); `forge test --match-contract KuruForkTest` at block 108,620,089: PASS, 1,416,102 gas, order id 111,029,158 rested and was cancelled; docs.monad.xyz: "All opcodes as of the Fusaka fork are supported" and "The `osaka` EVM target is required when compiling contracts for Monad" | branch `29-foundry-monad` |
