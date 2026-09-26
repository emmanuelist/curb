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
