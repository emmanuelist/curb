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

