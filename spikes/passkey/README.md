# Spike #2: one passkey, two keys, a signed tx

Throwaway spike for [#2](https://github.com/emmanuelist/curb/issues/2). Not product code.

It proves, in Chromium with a CDP virtual authenticator (PRF enabled):

- one passkey yields two unrelated EVM keys (owner, trading) via Mera PRF with two salts, and deterministically;
- Mera's canonical BIP-44 derivation (indices 0 and 1 from one PRF output) also works;
- the trading key signs and sends a tx through `toViemAccount` on an anvil fork of Monad mainnet with **zero** passkey prompts.

## Run it

```bash
npm install && npm run build          # needs bun for the bundle step
anvil --fork-url https://rpc.monad.xyz --chain-id 143 --port 8545 --host 127.0.0.1
python3 -m http.server 5391 --bind :: # serve this folder; open http://localhost:5391
```

Then, in a Playwright/CDP session:

1. `WebAuthn.enable`.
2. `WebAuthn.addVirtualAuthenticator` with `{ protocol: "ctap2", transport: "usb", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true }`.
3. Call `window.runSpike()`.

The page logs addresses and equality checks only, never key material. Result: docs/EVIDENCE.md E-002.
