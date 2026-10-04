# Demand: who needs a trading key that can't withdraw

Curb hasn't been used by anyone outside the team. Every Curb transaction on mainnet is the builder's own (E-019, E-028). This page makes the case for demand from public research and from what Monad's order books show today. Every number links to its source or to a command you can rerun.

## 1. Traders already ask exchanges for keys that can trade but not withdraw

Binance's API keys carry separate permissions for reading, spot and margin trading, and withdrawals (`enableReading`, `enableSpotAndMarginTrading`, `enableWithdrawals`, in [Get API Key Permission](https://developers.binance.com/docs/wallet/account/api-key-permission)). A trading bot gets a key that can trade and can't withdraw. This is how automated trading is set up on a centralised exchange.

## 2. "Can't withdraw" wasn't enough: 3Commas, 2022

In late 2022, about 100,000 API keys held by the trading-bot platform 3Commas leaked. HAPI Labs' analysis ([via ForkLog](https://forklog.com/en/news/api-key-leaks-and-exchange-inaction-a-hapi-analysis-of-the-3commas-incident)) explains how the attackers took money with keys that couldn't withdraw:

> the attackers, using external accounts on centralised platforms, placed sell orders for illiquid assets at high prices. Then, through the victims' accounts to which they gained API access, criminals swapped these assets on the order book for highly liquid ones.

One victim's liquid assets fell from 50 BTC to 7 BTC, with "43 BTC … on the other side". The verified losses were $27.3M across 86 users: Binance $23.5M, KuCoin $2.1M, Coinbase Pro $1.5M.

The keys were trade-only. The money left through trades made at prices nobody else would have paid.

**What Curb's account refuses.** The account checks each order in the same transaction that places it:

- **A market the account doesn't allow** is refused (`MarketNotAllowed`, `PerpNotAllowed`).
- **A price outside ±0.50% of the venue's live best bid and ask** is refused (`OffLane`, `PerpOffLane`). The bid and ask are read from Kuru's or Perpl's book onchain.
- **Leverage over the cap the owner key set** is refused (`LeverageAboveCap`).
- **Any withdrawal by the trading key** is refused (`NotOwner`).

The lane, cap and withdrawal refusals have each happened on mainnet (E-019, E-028). The market check is proven in fork tests against Monad mainnet (E-015, E-021).

An exchange can't offer the price check to a third-party key, because its book is offchain. On Monad it can be done, because Kuru's book and Perpl's book are contracts.

**The limit.** The lane bounds price, not frequency. A stolen trading key could still trade back and forth inside the lane, losing up to about 0.50% plus fees each round trip. It can't withdraw, and it can't trade at a price set by the attacker.

## 3. On Monad today, liquidity is placed by keys that only pay gas

We took two 15-minute samples of mainnet on 2026-10-04 (E-037). The command reads public logs only:

```bash
cd web && node scripts/order-flow-sample.mjs 3000
```

**Kuru MON-USDC** (blocks 110,512,997–110,515,996):

- 5,955 orders were created and 5,959 cancelled, with 12 trades.
- Every order came from three owners, all of them contracts.
- The largest owner placed 71% of the orders at 140 transactions a minute. It holds 1,188,004 MON and 92,620 USDC on Kuru.
- Its orders are signed by three keys that hold 118 to 140 MON each, which is gas money.
- The second owner placed 29% and works the same way: one signing key, with the funds in the contract.

**Perpl MON perpetual** (same blocks):

- 3,279 order requests came from 16 accounts.
- Account #25 sent 42% of them at 63 a minute. It belongs to a contract holding 1,416,692 AUSD, and its orders are signed by six keys holding about 1,090 MON each.
- Account #1767 sent 21% at 45 a minute and works the other way round. One key signs its orders and also controls the account's 322,960 AUSD.

The market makers on both venues already split the key that trades from the money. Most of them built that split for themselves. Curb gives the same split to anyone with a passkey, and it adds the one thing their setups don't: a bound on price that the contract enforces against the live book.

## What this doesn't show

- **No outside users.** Curb has no outside users. The usage on mainnet is the builder's.
- **Two samples.** These are two 15-minute windows on one day, not a long study.
- **Unread contracts.** We didn't read the market makers' contracts, so we don't claim how they restrict withdrawals. We claim only that the funds sit in the contracts and not with the keys that sign.
