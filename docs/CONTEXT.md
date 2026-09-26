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
- Caveat: fork tests run Kuru's bytecode in revm under **Ethereum** gas rules. Monad's gas-limit charging and reserve-balance rules are not simulated.

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

## Mera (`@category-labs/mera` 0.2.0; verified by reading `dist/*.d.ts`, 2026-09-26)

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
- **Newer Foundry refuses Monad forks.** CI's default Foundry (via foundry-toolchain v1.9.1, 2026-09-26) failed `vm.createSelectFork` with "cannot create a `monad` fork with an EVM instantiated for `ethereum`". Foundry **1.4.4** forks fine (E-001). CI is pinned to v1.4.4. Before upgrading, find the Monad network setting in the newer Foundry's docs. (verified in CI run 36271718824)
- Kuru's `Trade` event records `txOrigin`, so the trading-key EOA shows up as the origin even when CurbAccount is the owner.
- The testnet book is unusable for demos: no bids, one stray ask at 1.001 USDC, empty vault. (verified) → D-005.
- **Passkeys without PRF fail at creation.** `createPasskeyWithPrfOutput` throws `PRF_UNAVAILABLE`, most likely for judges on desktop Chrome with local-profile passkeys, or with Bitwarden/Dashlane intercepting. The app must catch it and say exactly what to do: use Safari, turn on Chrome's "Offer to save passwords and passkeys" (Google Password Manager), or open it on a phone. (verified: authenticator-support capture)
- **In-app browsers break passkeys.** Observed 2026-09-26 on the user's iPhone (iOS 18.7.9): Mera's live demo opened inside **Telegram's in-app browser** returned "The passkey request was cancelled or failed", and the Passwords app showed 0 passkeys afterwards.
  - **Isolated by contrast (verified):** the same phone and page succeeded minutes later in Safari. So the in-app browser is the cause. The mechanism is reported, not verified: iOS only allows WebAuthn in an app's WKWebView for that app's own associated domains, or in apps with the web-browser entitlement.
  - Judges often open links from X, Telegram or Discord, so Curb must detect in-app browsers and show "Open in Safari/Chrome" **before** starting the passkey ceremony, and map Mera's `PASSKEY_OPERATION_FAILED` to that same guidance.
- WebAuthn `rp.id` must equal the serving hostname. The recipe uses `location.hostname`. A passkey created on one domain (e.g. a Vercel preview URL) won't work on another, so demo and judging should use one stable production domain.

## Environment (names and purpose only, never values)

| Var | Purpose |
|---|---|
| `MONAD_RPC_URL` | Mainnet RPC for fork tests and scripts |
| `NEXT_PUBLIC_MONAD_RPC_URL` | Mainnet RPC for the web app |
| `NEXT_PUBLIC_RP_ID` | WebAuthn relying-party ID, which must equal the deployed domain |
| `DEPLOYER_PRIVATE_KEY` | Local only, for deploying CurbAccount contracts. Never committed. |
| `ELEVENLABS_API_KEY` | M3 narration only (user-provided) |

Local dev note (the user's machine): **port 5173 is already used by another project's Vite server**, and `localhost` resolves to it over IPv6. Use another port for Curb's dev server.
