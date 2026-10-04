# Context

Verified facts about everything Curb depends on. Each entry says how it was verified, so no session has to re-derive it or trust training data. Read this before touching Kuru, Mera or Monad specifics. Raw outputs are in `internal/research/raw/chain-checks-2026-09-26.md`.

Status tags: **verified** = a check we ran (command + date) · **reported** = read in docs or a summary but not captured verbatim · **unverified** = assumed, needs a check.

## Networks

| Name | Chain ID | RPC | Verified |
|---|---|---|---|
| Monad mainnet | 143 | `https://rpc.monad.xyz` | verified 2026-09-26: `eth_chainId` → 0x8f; block ~108.2M |
| Monad testnet | 10143 | `https://testnet-rpc.monad.xyz` | verified 2026-09-26 (not used; D-005) |

**WebSocket:** `wss://rpc.monad.xyz` streams new blocks (verified 2026-09-26: 6 blocks, gaps 24–517 ms, about 330 ms average). `wss://rpc.monad.xyz/ws` timed out; drpc's free plan refuses subscriptions.
**viem:** `viem/chains` → `monad` (id 143) carries both RPCs, both WebSockets, Multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11` (code verified onchain) and explorers.
**Explorers:** Monadscan `https://monadscan.com/tx/<hash>` and `/address/<addr>` return 200 (verified); Curb links there. MonadVision returns 403 to non-browser clients, so it's unverified.

## Contracts we call (Monad mainnet)

Addresses from https://docs.kuru.io/contracts/Contract-addresses (captured 2026-09-26). The code checks are `eth_getCode`, non-empty.

| Name | Address | Verified how |
|---|---|---|
| Kuru MarginAccount (proxy) | `0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5` | code present |
| Kuru MON-USDC market (OrderBook proxy) | `0x065C9d28E428A0db40191a54d33d5b7c71a9C394` | code present; live book (bid 0.026866 / ask 0.026883 at block 108,227,602) |
| Kuru MON-AUSD market | `0x131a2e70a5b31a517a74b8c567149bc294470da9` | code present; **book empty, vault 0** |
| Kuru Router (market factory) | `0xd651346d7c789536ebf06dc72aE3C8502cd695CC` | code present; `deployProxy` → `Unauthorized()` for arbitrary callers |
| USDC | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | code present |
| AUSD | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` | code present |
| **CurbFactory (ours, #31)** | `0x633Bf378031d694Bcb8E39E6CF160efD75Af18e8` | deployed block 108,627,002 (E-016); Sourcify exact match; accounts at `accountOf(owner, trader)` |
| **CurbFactory v2 (ours, #50; the app's factory)** | `0xC3b37bfa0c4496005F01a9E92cD5d285398db000` | deployed block 110,314,645 (E-024) with `forge create`; Sourcify exact match (creation and runtime); Kuru MarginAccount + MON-USDC, Perpl Exchange, collateral AUSD, perp 10, cap 500 (5×); accounts at `accountOf(owner, trader)` |
| WMON | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` | from docs only; code unverified |
| KuruFlowEntrypoint / KuruFlowRouter / KuruForwarder | `0xb3e6…13cb` / `0x0d3a…FFa2` / `0x974E…FAA` | from docs only; unverified |

### MON-USDC market parameters (verified: `getMarketParams()` at block 108,227,602; field order confirmed by E-001)

| pricePrecision | sizePrecision | base | baseDecimals | quote | quoteDecimals | tickSize | minSize | maxSize | takerFeeBps | makerFeeBps |
|---|---|---|---|---|---|---|---|---|---|---|
| 1e8 | 1e10 | native MON (`0x0`) | 18 | USDC | 6 | 100 | 2e12 | 2e18 | 0 | 0 |

`bestBidAsk()` is **1e18-scaled** (verified, E-001): order price (pricePrecision units) = `bestBid * pricePrecision / 1e18`. An order placed at that price became the new best bid exactly.

**Kuru behaviour confirmed on a mainnet fork (E-001, 2026-09-26):**

- A **contract** can be the order owner: `s_orders(id)` returns the contract as the owner. (resolves D-004's open question)
- `MarginAccount.getBalance` is in the **token's own decimals** (50 USDC → `50000000`).
- A resting buy locks **price × size** of quote from margin (0.026702 × 200 MON = 5.3404 USDC).
- A new order's id is `s_orderIdCounter()` read **after** placement (the counter increments, then assigns).
- `batchCancelOrders` returns the locked quote; `withdraw(amount, token)` pays `msg.sender`.
- **Smallest order = minSize 2e12 / sizePrecision 1e10 = 200 MON**, about $5.34 at 0.0267. Budget any real mainnet trade at ≥ $6 of USDC plus gas.
- Forking Monad mainnet through the public RPC works: the test completes in about 13.5 s, with no historical-state errors at the fork block.
- Fork tests now run under **Monad** execution rules (`network = "monad"`, Foundry 1.8.3), not Ethereum's: E-001's round trip used 1,416,102 gas that way (2026-09-28).

**Native MON margin (verified on a fork, 2026-09-28):** `MarginAccount.deposit{value: amount}(user, address(0), amount)` credits `user` with native MON, and a 200 MON resting sell locks exactly 200 MON of it. `withdraw(amount, address(0))` pays native MON to the caller (a contract needs `receive()`).

## Kuru ABI surface (from `@kuru-labs/kuru-sdk` 0.0.95 `abi/*.json`, last published 2026-01-27)

The ABI may lag the deployed implementation. Fork tests are the source of truth.

**OrderBook**

- `addBuyOrder(uint32 _price, uint96 size, bool _postOnly)` / `addSellOrder(...)`
- `batchCancelOrders(uint40[] _orderIds)`
- `placeAndExecuteMarketBuy(uint96 _quoteSize, uint256 _minAmountOut, bool _isMargin, bool _isFillOrKill) payable returns (uint256)`
- `placeAndExecuteMarketSell(uint96 _size, uint256 _minAmountOut, bool _isMargin, bool _isFillOrKill) payable returns (uint256)`
- `bestBidAsk() view returns (uint256, uint256)` · `getMarketParams()` · `getL2Book() returns (bytes)` · `s_orders(uint40)`
- Events: `OrderCreated(uint40 orderId, address owner, uint96 size, uint32 price, bool isBuy)`, `OrdersCanceled(uint40[] orderId, address owner)`, `Trade(... address takerAddress, address txOrigin, uint96 filledSize)`

**MarginAccount**

- `deposit(address _user, address _token, uint256 _amount) payable`: credits `_user`, so anyone can deposit for any user
- `withdraw(uint256 _amount, address _token)`
- `getBalance(address _user, address _token) view returns (uint256)`
- `batchWithdrawMaxTokens(address[] _tokens)`

**Errors seen onchain:** `Unauthorized()` 0x82b42900 · `SizeError()` 0x0a5c4f1f · `InsufficientBalance()` 0xf4d678b8

**Order placement is permissionless** (verified): `eth_call addBuyOrder` from a random EOA reverts `InsufficientBalance()`, not `Unauthorized()`. A **contract** can be the order owner (verified on a fork, E-001).

## Perpl (perps on Monad; verified 2026-10-03)

- **Exchange** `0x34B6552d57a35a1D042CcAe1951BD1C370112a6F`: an EIP-1967 proxy (proxy verified on Sourcify) → implementation `0xa9Ab97A404A0bCA04d6A5b4a39995feA9E791b2A` (not verified). `getContractVersion()` = 1.7.5. **ABI:** `abi/dex/Exchange.json` and `Errors.abi.json` in the `perpl-sdk` crate 0.2.9 (crates.io, repo PerplFoundation/dex-sdk). Docs: github.com/PerplFoundation/api-docs.
- **Collateral:** AUSD `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a`, 6 decimals (CNS = AUSD × 10⁶). `getMinAccountOpenCNS()` = 10 AUSD; minimum post 0; whitelisting off; not halted.
- **A contract can own a Perpl account** (`createAccount(amountCNS)` from the contract after `approve`) and trade with `execOrder` (E-020).
- **OrderDesc** fields: `orderDescId, perpId, orderType, orderId, pricePNS, lotLNS, expiryBlock, postOnly, fillOrKill, immediateOrCancel, maxMatches, leverageHdths, lastExecutionBlock, amountCNS, maxNegPnlCollatBPS`. Order types: 0 OpenLong, 1 OpenShort, 2 CloseLong, 3 CloseShort, 4 Cancel (`orderId` set), 5 IncreasePositionCollateral, 6 Change. Bids are 0 and 3; asks are 1 and 2. The SDK's defaults: leverage 10 → `leverageHdths` 1000, `amountCNS` 0, `maxNegPnlCollatBPS` 1000.
- **Book reads onchain:** `getPerpetualInfo(perpId)` returns `markPNS`, `oraclePNS`, `lastPNS`, `maxBidPriceONS` (best bid), `minAskPriceONS` (best ask), `basePricePNS` (PNS = ONS + base; base is 0 on live perps), `numOrders`, `status`. An empty side reads 0. Depth: `getNextPriceAboveWithOrders` / `getNextPriceBelowWithOrders`, `getVolumeAtBookPrice`.
- **Events:** `OrderPlaced(uint256 orderId, uint256 lotLNS, uint256 lockedBalanceCNS, int256 amountCNS, uint256 balanceCNS)` gives a resting order's id. Others: `OrderCancelled`, `MakerOrderFilled(V2)`, `PositionIncreased(V2)`, `PositionClosed`, `CollateralDeposit`, `CollateralWithdrawal`, `AccountCreated(address account, uint256 id)`.
- **MON perp is id 10:** `priceDecimals` 6 (price = PNS / 10⁶ USD), `lotDecimals` 0 (1 lot = 1 MON). Other live perps: BTC 1, ETH 20, SOL_v2 31, HYPE 40, ZEC 50, LIT 60, VVV 70, PUMP 90, NEAR 100, UNI 110. Fees: `getTakerFee` 345 and `getMakerFee` 45 (the SDK's fee setters name the unit PPM).

- **Perpl receipts (verified on a fork, 2026-10-03):** a taking order emits one `TakerOrderFilledV2(entryPricePNS, collatPricePNS, pnlPricePNS, lotLNS, feeCNS, amountCNS, balanceCNS, builderId, builderFeeCNS)` per order (Perpl batches every maker fill under it, as perpl-sdk's stream/trade.rs does), `PositionOpenedV2` for a new position, and `MakerOrderFilledV2` / `PositionIncreasedV2` **for each maker, carrying the maker's account id**. Read a taker's fill from `TakerOrderFilled*`, not from position events. A resting order emits `OrderPlaced(orderId, …)`.
- **Perpl's price must be fresh to settle a taker:** `refPriceMaxAgeSec` is 60 for MON; `setPriceMaxAge` reverts above 300. On an anvil fork the oracle never updates, so taking orders fail with `TakerOrderSettlementFailed` once the fork's clock passes 60 s. Freeze the fork's clock right after forking: `cast rpc anvil_setBlockTimestampInterval 0`. Resting orders, cancels and the account's refusals don't depend on it.
- **`getAccountByAddr` reverts `AccountDoesNotExist`** for an address without a Perpl account (check `CurbAccount.perplOpened()` first); `getPositionV2` returns zeros for no position.
- **Reading Perpl's book:** there is no L2 view, only `getNextPrice{Above,Below}WithOrders` and `getVolumeAtBookPrice` per level (0 past the edge; a level can hold only expired orders, with zero live volume). `contracts/src/readers/PerplBookReader.sol` walks it inside one deployless `eth_call` (viem `call({ code })`).
- **Perpl reuses order ids (verified 2026-10-04).** The book has 2^16−1 slots and hands a freed id straight out again; perpl-sdk 0.2.9 `state/order.rs` notes that even one request can reuse an id. On a fork, three successive resting orders from one account were each #35, each placed after the last was cancelled. Never key an order's state by id alone. Pair a cancel or a fill with the latest earlier order that held the id. Check that the slot still holds the order before calling it yours: `getOrderV2(perpId, id)` must match on `accountId`, `orderType` and `priceONS` (`priceONS` + `getPerpetualInfo().basePricePNS` = the order's PNS price). An empty slot returns all zeros; it doesn't revert (fork and mainnet). `orderDescId` is a client id that appears only in events, not on the stored order.
- **Maker fills:** `MakerOrderFilled(V2)(perpId, accountId, orderId, pricePNS, lotLNS, feeCNS, lockedBalanceCNS, amountCNS, balanceCNS[, builderId, builderFeeCNS])`, all unindexed. Scan the exchange's logs and match on perpetual, account and order id. Decoded from a real mainnet log (block 110,306,199, tx 0x80be3795…a217e3), and seen for the app's own resting order on a fork (E-023).

## Swapping MON for AUSD (verified 2026-10-04)

- **Kuru Flow** is Kuru's swap aggregator (docs.monad.xyz/guides/kuru-flow).
  - API at `https://ws.kuru.io`.
  - Token: `POST /api/generate-token {user_address}` returns `{token, expires_at, rate_limit: {rps: 1, burst: 1}}`. No secret; the token lasts about a day.
  - Quote: `POST /api/quote` with `Authorization: Bearer <token>` and `{userAddress, tokenIn, tokenOut, amount, autoSlippage}`. It returns `{status, output, minOut, transaction: {to, calldata (no 0x prefix), value}}`.
  - Native MON is `0x0…0`, sent as the transaction's `value`.
  - CORS answers `*` and allows `Authorization`, so a browser can call it directly.
- **Router:** `KuruFlowEntrypoint` at `0xb3e6778480b2E488385E8205eA05E20060B813cb`. Sourcify match; not a proxy.
  - Quotes decode as `executeSwap((tokenUserBuys, minAmountUserBuys, tokenUserSells, amountUserSells), (feeCollectorAddress, feeBps, referrerAddress, referrerFeeBps, isInTokenFee), program)`, selector `0xce1e7030`. The other entrypoint is `executeSwapWithReceiver(…, receiver)`.
  - Quotes carried `feeBps` 0.
  - 450 MON quoted at 15.23 AUSD. On a fork, a 450 MON swap used 504,324 gas (limit 605,188, estimate × 1.2) and delivered 15.297463 AUSD (E-026).
- **Uniswap v4 on Monad** (developers.uniswap.org deployments):

  | Contract | Address |
  |---|---|
  | PoolManager | `0x188d586ddcf52439676ca21a244753fa19f9ea8e` (the busiest AUSD counterparty onchain) |
  | V4Quoter | `0xa222dd357a9076d1091ed6aa2e16c9742dd26891` |
  | StateView | `0x77395f3b2e73ae90843717371294fa97cc419d64` |
  | Universal Router | `0x0d97dc33264bfc1c226207428a79b26757fb9dc3` |
  | Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

  Native MON/AUSD pools without hooks:
  - fee 100 / tickSpacing 1: nearly empty.
  - fee 10000 / tickSpacing 200: 450 MON → 14.48 AUSD, about 5% under Kuru Flow.

## Mera (`@category-labs/mera` 0.2.0; verified by reading `dist/*.d.ts`, 2026-09-26)

- **Two PRF salts in one ceremony:** Mera's options accept `webAuthnClient` (the `WebAuthnClient` type is exported). A client that adds `extensions.prf.eval.second` gets both outputs from one `create` or `get`. Chrome's virtual authenticator (`ctap2_1`, `hasPrf`) returns both at creation and at assertion (E-032). On the user's iPhone (Safari), an assertion returned both outputs: sign-in took one Face ID (E-033). PRF at creation on iOS is unverified.
- **Safari Private Browsing on iOS offers the iCloud Keychain passkey, PRF included** (2026-10-04, the user's iPhone, E-031): a private tab is a clean device for the stateless test.

- `createPasskeyWithPrfOutput({ rp: { id, name }, user: { name, displayName }, timeout?, prfSalt?, webAuthnClient? })` returns credential metadata plus `prfSalt` and a 32-byte `prfOutput`. It shows one prompt, or two on authenticators that don't evaluate PRF at creation.
- `getPasskeyPrfOutput({ rpId, credential?, prfSalt?, timeout?, webAuthnClient? })` returns a 32-byte `prfOutput`. It shows **one user-verification prompt per call**, and UV isn't configurable.
  - Default salt: `sha256("mera.prf.salt.v1")`.
  - **"A different salt yields an unrelated output."** This is our "many keys" mechanism: owner salt → key A, trading salt → key B.
- `createSecp256k1SigningSession({ privateKey })` returns a session; `end()` zeroes the key.
- `getEvmAddress(publicKey)` returns an EIP-55 address.
- `toViemAccount(session, { nonceManager? })` from `@category-labs/mera/viem` returns a viem `LocalAccount`. "Signing never shows a passkey prompt." It supports `signTransaction`, `signMessage`, `signTypedData`, `signAuthorization` (7702) and `sign`.
- Secret vaults: `createSecretVaultWithNewPasskey` / `createSecretVaultWithExistingPasskey` / `decryptSecretVaultWithPasskey` / `parseSecretVault` encrypt a secret under a PRF output.
- Peers: `viem ^2.28.0` (optional), `react-native-passkey` 3.6.1 (optional, native only).
- Platforms (README): web browsers, Chrome extensions, React Native (iOS 18+, Android 9+).
- **PRF support** (verified: captured mera.category.xyz/authenticator-support, 2026-09-26; ✓ = Category Labs confirmed a live create+get cycle):

  | Works | Doesn't |
  |---|---|
  | iCloud Keychain in Safari **and** Chrome on iOS 18+; Safari/Chrome/Firefox on macOS 15+ | **Desktop Chrome local-profile passkeys** (no hmac-secret) |
  | Google Password Manager in Chrome on Android and signed-in desktop Chrome | Bitwarden, Dashlane |
  | 1Password, Proton Pass, YubiKey 5, Windows 11 25H2+ | |

  **Verified on the user's iPhone (iOS 18.7.9, Safari), 2026-09-26:** Mera's live demo created a passkey account and showed address `0x6Fa0…6e4a`. Screenshot: internal/research/raw/mera-demo-iphone-safari-OK-2026-09-26.png.
- **Mera's canonical key derivation** (verified: captured recipe "create-passkey-accounts"): `prfOutput` → `entropyToMnemonic` (BIP-39) → `mnemonicToSeedSync` → BIP-32 `m/44'/60'/0'/0/{index}` → `createSecp256k1SigningSession`. This needs `@scure/bip32`, `@scure/bip39` and `@noble/hashes`.
  - In that scheme **one prompt yields every indexed key**. So whenever the trading key is derived, the owner key is derivable in the same moment.
  - The alternative is a **separate PRF salt per role**: `getPasskeyPrfOutput({ prfSalt })` gives unrelated outputs, so the trading-key material never contains the owner key. The cost is one prompt per role.
  - Which one Curb uses is decided at M2, after reading the Mera bounty text (#5).
- **Sessions** (verified: captured "signing-sessions"): a session holds the key in memory until `end()`. After `end()`, the next signature needs a new ceremony and prompt. Session lifetime is "a trade-off between that prompt and the open window."
- **Mera's live demo** (for checking a real device with zero setup): https://mera.category.xyz/demo/index.html
- **Verified end to end in a browser (E-002, 2026-09-26):**
  - Both derivation approaches produce distinct, reproducible addresses: separate salts (`sha256("curb.owner.v1")` / `sha256("curb.trade.v1")`), and BIP-44 indices 0/1 from the default salt.
  - The PRF output returned by `createPasskeyWithPrfOutput` equals a later `getPasskeyPrfOutput` with the default salt.
  - `toViemAccount(session)` + viem `sendTransaction` works with **0 passkey ceremonies**.
- **End-to-end on a fork (E-004):** run `anvil --fork-url https://rpc.monad.xyz --chain-id 143`, then `NEXT_PUBLIC_MONAD_RPC_URL=http://127.0.0.1:8545 npx next dev`. A fresh Playwright context lets you add an `internal` virtual authenticator again. Fund keys with `anvil_setBalance`.
- **Automating passkeys (for tests and the demo recording):** Chromium 154 via CDP `WebAuthn.addVirtualAuthenticator` supports `hasPrf: true`. Only **one `internal` authenticator per browser environment** is allowed; a second throws, so use `transport: "usb"` or reuse the first. `rp.id` `localhost` is accepted over http.

## Traps

- **Gas is charged on the gas limit, not gas used.** Set explicit, tight gas limits. (reported: docs.monad.xyz/developer-essentials/differences)
- **EIP-7702-delegated EOAs can't drop below 10 MON**, and CREATE/CREATE2 are banned in delegated code. (reported: same page) → D-004.
- Full nodes don't serve arbitrary historical state; there's no global mempool. (reported: same page)
- **Kuru market creation is gated on mainnet** (`Unauthorized()` on Router and MonadDeployer) and open on testnet. (verified)
- **An empty book returns sentinels:** MON-AUSD `bestBidAsk()` → (2^256−1, 0); testnet MON-USDC → (2^256−1, 1.001e18) with no bids. The price check must treat these as "no market" and **refuse**, never compute a band from them. (verified)
- Orders below `minSize` revert `SizeError()`. (verified)
- **Foundry needs `network = "monad"` to fork Monad.** Without it, newer Foundry refuses a Monad fork ("cannot create a `monad` fork with an EVM instantiated for `ethereum`", CI run 36271718824). Foundry **1.8.3** with `network = "monad"` forks fine and runs tests under Monad's gas model (charged on the gas limit), opcode pricing and contract-size limits; E-001's round trip passes that way (2026-09-28). Monad's docs require the `osaka` EVM target (they state bytecode compatibility with Ethereum as of Fusaka). CI is pinned to v1.8.3.
- Kuru's `Trade` event records `txOrigin`, so the trading-key EOA shows up as the origin even when CurbAccount is the owner.
- The testnet book is unusable for demos: no bids, one stray ask at 1.001 USDC, empty vault. (verified) → D-005.
- **Passkeys without PRF fail at creation.** `createPasskeyWithPrfOutput` throws `PRF_UNAVAILABLE`, most likely for judges on desktop Chrome with local-profile passkeys, or with Bitwarden/Dashlane intercepting. The app must catch it and say exactly what to do: use Safari, turn on Chrome's "Offer to save passwords and passkeys" (Google Password Manager), or open it on a phone. (verified: authenticator-support capture)
- **In-app browsers break passkeys.** Observed 2026-09-26 on the user's iPhone (iOS 18.7.9): Mera's live demo opened inside **Telegram's in-app browser** returned "The passkey request was cancelled or failed", and the Passwords app showed 0 passkeys afterwards.
  - **Isolated by contrast (verified):** the same phone and page succeeded minutes later in Safari. So the in-app browser is the cause. The mechanism is reported, not verified: iOS only allows WebAuthn in an app's WKWebView for that app's own associated domains, or in apps with the web-browser entitlement.
  - Judges often open links from X, Telegram or Discord, so Curb must detect in-app browsers and show "Open in Safari/Chrome" **before** starting the passkey ceremony, and map Mera's `PASSKEY_OPERATION_FAILED` to that same guidance.
- WebAuthn `rp.id` must equal the serving hostname. The recipe uses `location.hostname`. A passkey created on one domain (e.g. a Vercel preview URL) won't work on another, so demo and judging should use one stable production domain.

- **A Vercel project created by name (`vercel project add`) gets Framework Preset "Other"**: the build serves only `public/`, so every page is a 404 while images load. `web/vercel.json` pins `"framework": "nextjs"`; keep it. (verified 2026-09-27: first production deploy 404s; after the pin, `vercel build` reports nextjs 16.3.6 with 28 routes and every route returns 200)

- **Next 16 deprecated `priority` on `next/image`**, and its images now default to `loading="lazy"`. For the LCP image set **both** `loading="eager"` and `fetchPriority="high"` (with only the latter, production still served it lazy and Lighthouse failed "LCP image was lazily loaded"; fixed, load delay 1,323 → 57 ms). A bare `preload` emits a head preload that Chrome fetches at *Low* (verified 2026-09-27 in Lighthouse network data: the photo went Low → High only with `fetchPriority`).
- **TanStack Query shares structure only within one query key.** A key that changes every refresh (e.g. per block bucket) returns fresh objects each time, so `memo`/`useMemo` downstream never hit. Keep one stable key and `refetch()` on the bucket change. (verified 2026-09-27)
- **`box-shadow` animations restyle every frame.** The per-block live-dot pulse cost ~7 points of main-thread time at 4x CPU; the same pulse as a transform/opacity ring is compositor-only. (verified 2026-09-27, CDP Performance metrics)
- **Local `vercel build` writes `web/.vercel/output`**, which ESLint then scans (thousands of findings). It is ignored in `eslint.config.mjs`. (verified 2026-09-27)

- **Vercel deploys come from GitHub now (D-016).** The project's root directory is `web`, so a manual `vercel deploy` must run from the repo root (running it inside `web/` would look for `web/web`). Local `vercel build` output still lands in `web/.vercel/output` and is lint-ignored.

- **Monad's reserve balance (docs.monad.xyz/developer-essentials/reserve-balance, captured 2026-09-28):** every EOA keeps a 10 MON reserve. A transaction reverts at execution if its *value* transfer leaves the sender below 10 MON, **unless** it is an "emptying transaction": the sender is undelegated and sent no other transaction in the past k = 3 blocks (~1.2 s). Consequences for Curb: the trading key's orders carry no value, so only gas counts (budget min(10 MON, balance) across inflight txs); an owner-key deposit or send that ends below 10 MON must not follow another owner-key tx within ~1.2 s. Verified live: the deployer went from 0.7898 to exactly 0 MON in one emptying transaction (E-016).
- **`eth_getLogs` on rpc.monad.xyz is limited to a 100-block range** (error -32614 "eth_getLogs is limited to a 100 range"; a 1,000-block query fails; verified 2026-09-28). Kuru's MON-USDC book emits ~1,500–1,800 logs per 100 blocks.
- **Kuru `s_orders` after an order leaves the book (verified 2026-09-28):** `batchCancelOrders` clears the slot (owner 0, size 0; 30/30 sampled mainnet cancels). A fill usually clears it too (6 of 7 sampled mainnet full fills), but a limit order crossing it on a fork left `owner` set with `size` 0. So owner-kept + size 0 proves a fill; a cleared slot is a fill or a cancel.
- **Anvil fork: the first `getL2Book` read takes ~50 s** while anvil pulls the book's storage from the remote RPC (the browser's 10 s timeout gives up first). Warm it with one read before loading the app; later reads are instant.
- **Gas the app's transactions used on a fork under Monad rules (E-017):** create 1,161,151; MON deposit 78,784; resting placeSell 324,104–352,246; cancel 177,797; a sell taking one level 298,777. Limits in `web/src/lib/curb/account.ts` sit above these.
- **The public RPC traces and replays (verified 2026-10-03):** `debug_traceTransaction` with `{"tracer":"callTracer"}` answers on rpc.monad.xyz and carries a reverted call's `output` (the revert data); `eth_call` at a block 1,000 back answers too. Receipts don't carry revert data, so the app reads it from the trace.
- **Monad receipts report `gasUsed` equal to the gas limit** (what's charged): 8/8 sampled mainnet txs, plus the factory deploy (2026-10-03). So `gasUsed × effectiveGasPrice` is the fee paid. Anvil `--network monad` reports the gas actually used instead.
- **viem `call` revert data** sits on the RPC error a few causes down (CallExecutionError → ExecutionRevertedError → RpcRequestError `.data`), not on a RawContractError; `revertDataFrom` in `web/src/lib/curb/account.ts` walks the chain (verified on anvil and on mainnet).
- **Kuru refuses a crossing post-only order** with `PostOnlyError()` 0x06e6da4d instead of filling it (fork, 2026-10-03). A post-only order inside the lane but behind the best price rests normally.
- **Gas for #33's transactions on a fork under Monad rules:** trading key's withdrawal attempt (reverts `NotOwner`) 22,930; off-lane order (reverts `OffLane`) 172,826–172,868; owner withdraw MON to a plain address 99,010, USDC 180,112; a crossing post-only sell (reverts in Kuru) 315,753.
- **`forge script` can't deploy CurbFactory v2:** it aborts before broadcasting with "Failed to decode constructor arguments … buffer overrun" (it mis-slices the constructor arguments). `forge create … --constructor-args …` works. The v2 mainnet deploy estimates 2,888,343 gas.
- **Kuru Flow's estimates can run above what the route pays.** On 2026-10-04 they ran about 1% high, below even the minimum Kuru writes in, so its own transactions reverted with `KuruFlowEntrypoint_InsufficientAmountAfterFees()` (`0x5264a63f`). Simulate the route with `minAmountUserBuys` 1 and set the minimum from what it pays (D-027).
- **A fresh fork's first `PerplBookReader` call takes 30–40 s.** Anvil fetches each storage slot the walk touches from the remote RPC, so the app's 10 s timeout gives up and the block pill reads "Stalled". Warm the fork with one long-timeout call; after that it answers in 8 ms.
- **A taking order that walks levels can exceed 450,000 gas.** A two-level close used 615,930 (E-029), so measure it (D-028).
- **The Playwright virtual authenticator lasts only as long as the browser session.** After a restart, add one with `WebAuthn.addVirtualAuthenticator` (`hasPrf: true`) and onboard a new test passkey. If the old one is still attached, adding fails ("only supports one internal authenticator per environment") and its id is lost: close the browser first. The MCP browser's profile persists, so clear the origin's `localStorage` too, or the app keeps a record whose credential no longer exists.
- **Playwright's full-page screenshots replay CSS animations.** A capture with `fullPage: true` caught the hero price's 320 ms `digit-settle` from 35% opacity, so the price read grey (#848687) in every 1280 full page, while a settled viewport capture reads #EDEDED. Capture tall pages by setting the viewport to the page's height and taking a normal screenshot (#47).
- **Perpl's `getPositionV2` returns `markValid`.** It is false when Perpl's price is stale (as on an aged fork); the mark it returns then isn't one. Curb prints a dash for the mark and the PnL figured from it (#47).
- **Playwright's `page.clock.install()` stops Next's dev server from applying edits.** Fast Refresh logs "done" and the served chunk has the new code, but the page keeps running the old module. Reload after each edit while the fake clock is installed (#42).
- **The public RPC answers JSON-RPC batches** (40 historical nonce reads in 1.4 s), and returns an occasional 429 under bursts; viem's retries absorb it. It may refuse state far in the past: "Request might be querying historical state that is not available". `eth_getTransactionBySenderAndNonce` is "Method not found", so find transactions by searching historical nonces (#40).
- **A fork answers historical reads from before its fork point slowly, until cached.** Anvil fetches them from the remote node, and a cold batch outran viem's 10 s timeout; the history client allows 30 s.
- **A fork's pools freeze at its block.** A live aggregator quote fails against a fork that is more than a minute or so old. One fork delivered 15.264 AUSD against a 15.27 minimum, and Curb's dry run refused it before Face ID. Fork right before testing a swap.
- **Contract verification:** `forge verify-contract <addr> <path>:<Name> --chain 143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/ --constructor-args …` (no API key; shows on MonadVision). Monadscan's etherscan verifier needs an API key.

## Environment (names and purpose only, never values)

| Var | Purpose |
|---|---|
| `MONAD_RPC_URL` | Mainnet RPC for fork tests and scripts |
| `NEXT_PUBLIC_MONAD_RPC_URL` | Mainnet RPC for the web app |
| `NEXT_PUBLIC_RP_ID` | WebAuthn relying-party ID, which must equal the deployed domain |
| `DEPLOYER_PRIVATE_KEY` | Local only, for deploying CurbAccount contracts. Never committed. |
| `ELEVENLABS_API_KEY` | M3 narration only (user-provided) |

Local dev note (the user's machine): **port 5173 is already used by another project's Vite server**, and `localhost` resolves to it over IPv6. Use another port for Curb's dev server.
