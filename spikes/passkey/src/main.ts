// Spike #2: one passkey, two keys (Mera PRF), one signs a tx on a Monad mainnet fork.
// Throwaway. Logs addresses and equality checks only, never key material (CLAUDE.md rule 7).
import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getEvmAddress,
  getPasskeyPrfOutput,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { createPublicClient, createWalletClient, defineChain, http, parseEther, toHex } from "viem";

const monadFork = defineChain({
  id: 143,
  name: "Monad mainnet (anvil fork)",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

// Mera's canonical path (captured recipe): PRF output -> BIP-39 -> BIP-32 m/44'/60'/0'/0/{index}
function deriveEvm(prfOutput: Uint8Array, index: number) {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (!node.privateKey) throw new Error("derivation produced no key");
  const session = createSecp256k1SigningSession({ privateKey: node.privateKey });
  return { session, address: getEvmAddress(session.publicKey) };
}

async function runSpike() {
  const rpId = location.hostname;
  let ceremonies = 0;

  const created = await createPasskeyWithPrfOutput({
    rp: { id: rpId, name: "Curb spike" },
    user: { name: "spike@curb.local", displayName: "Curb spike" },
  });
  ceremonies++;
  const credential = { credentialId: created.credentialId, transports: created.transports };

  // Approach A: one salt per role -> unrelated PRF outputs.
  const ownerSalt = await sha256("curb.owner.v1");
  const tradeSalt = await sha256("curb.trade.v1");
  const ownerPrf = (await getPasskeyPrfOutput({ rpId, credential, prfSalt: ownerSalt })).prfOutput;
  ceremonies++;
  const tradePrf = (await getPasskeyPrfOutput({ rpId, credential, prfSalt: tradeSalt })).prfOutput;
  ceremonies++;
  const tradePrfAgain = (await getPasskeyPrfOutput({ rpId, credential, prfSalt: tradeSalt })).prfOutput;
  ceremonies++;
  const ownerA = deriveEvm(ownerPrf, 0);
  const tradeA = deriveEvm(tradePrf, 0);
  const tradeAAgain = deriveEvm(tradePrfAgain, 0);

  // Approach B: Mera's default salt, BIP-44 indices 0 and 1 (one ceremony yields both).
  const defaultPrf = (await getPasskeyPrfOutput({ rpId, credential })).prfOutput;
  ceremonies++;
  const ownerB = deriveEvm(defaultPrf, 0);
  const tradeB = deriveEvm(defaultPrf, 1);
  const createdMatchesDefault = created.prfOutput.every((b, i) => b === defaultPrf[i]);

  // Sign and send with the trading key (approach A) on the fork. No passkey prompt here.
  const account = toViemAccount(tradeA.session);
  const pub = createPublicClient({ chain: monadFork, transport: http() });
  // biome-ignore lint: anvil-only method
  await pub.request({ method: "anvil_setBalance", params: [account.address, toHex(parseEther("1"))] } as never);
  const wallet = createWalletClient({ account, chain: monadFork, transport: http() });
  const ceremoniesBeforeSigning = ceremonies;
  const hash = await wallet.sendTransaction({ to: ownerA.address, value: parseEther("0.01") });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  const ownerBalance = await pub.getBalance({ address: ownerA.address });

  const result = {
    rpId,
    prfOutputBytes: [ownerPrf.length, tradePrf.length, defaultPrf.length],
    approachA_separateSalts: {
      owner: ownerA.address,
      trade: tradeA.address,
      distinct: ownerA.address !== tradeA.address,
      tradeDeterministic: tradeA.address === tradeAAgain.address,
    },
    approachB_indices: { owner: ownerB.address, trade: tradeB.address, distinct: ownerB.address !== tradeB.address },
    createTimePrfEqualsDefaultSaltPrf: createdMatchesDefault,
    forkTx: {
      from: account.address,
      to: ownerA.address,
      hash,
      status: receipt.status,
      block: receipt.blockNumber.toString(),
      ownerBalanceWei: ownerBalance.toString(),
    },
    ceremonies,
    ceremoniesDuringSigning: ceremonies - ceremoniesBeforeSigning,
  };

  for (const s of [ownerA, tradeA, tradeAAgain, ownerB, tradeB]) s.session.end();
  return result;
}

(window as unknown as { runSpike: typeof runSpike }).runSpike = runSpike;
document.body.dataset.ready = "true";
