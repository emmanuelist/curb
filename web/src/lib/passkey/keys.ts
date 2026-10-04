import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getEvmAddress,
  getPasskeyPrfOutput,
  type PasskeyCredentialMetadata,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import type { Address, LocalAccount } from "viem";
import { dualSaltClient } from "@/lib/passkey/dual-salt";

export type KeyRole = "owner" | "trading";
/** Which keys a ceremony in progress is making: both at once (#41), or one when a device needs a second prompt. */
export type KeyStage = KeyRole | "both";

/**
 * One PRF salt per role (D-012). A different salt yields an unrelated PRF output (Mera, passkey.d.ts),
 * so unlocking the trading key never puts owner-key material in memory. Changing these changes every address.
 */
const SALTS: Record<KeyRole, Uint8Array<ArrayBuffer>> = {
  owner: sha256(utf8ToBytes("curb.owner.v1")),
  trading: sha256(utf8ToBytes("curb.trade.v1")),
};

export type CurbAccountRecord = {
  credential: PasskeyCredentialMetadata;
  owner: Address;
  trading: Address;
};

/**
 * Mera's canonical path (docs/CONTEXT.md, verified E-002): PRF output → BIP-39 entropy → seed →
 * BIP-32 m/44'/60'/0'/0/0. The derived account is an ordinary EOA a user could import elsewhere.
 */
function sessionFromPrf(prfOutput: Uint8Array) {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/0");
  if (!node.privateKey) throw new Error("Key derivation produced no private key");
  const session = createSecp256k1SigningSession({ privateKey: node.privateKey });
  node.wipePrivateData();
  return { session, address: getEvmAddress(session.publicKey) as Address };
}

async function derive(rpId: string, credential: PasskeyCredentialMetadata | undefined, role: KeyRole) {
  const { prfOutput, credentialId } = await getPasskeyPrfOutput({ rpId, credential, prfSalt: SALTS[role] });
  return { ...sessionFromPrf(prfOutput), credentialId };
}

/**
 * New passkey → owner and trading addresses, from one ceremony when the authenticator evaluates PRF at creation (#41):
 * the trading salt rides along as WebAuthn's second PRF input. Otherwise Mera's follow-up assertion carries both, so
 * it is never more than two prompts. No key is kept afterwards.
 */
export async function createAccount(rpId: string, onStage?: (stage: KeyStage) => void): Promise<CurbAccountRecord> {
  onStage?.("both");
  const handle = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("");
  const dual = dualSaltClient(SALTS.trading);
  const created = await createPasskeyWithPrfOutput({
    rp: { id: rpId, name: "Curb" },
    user: { name: `curb-${handle}`, displayName: `Curb account ${handle}` },
    prfSalt: SALTS.owner,
    webAuthnClient: dual.client,
  });
  const credential: PasskeyCredentialMetadata = { credentialId: created.credentialId, transports: created.transports };
  const owner = sessionFromPrf(created.prfOutput);
  const tradingOutput = dual.second();
  if (!tradingOutput) onStage?.("trading");
  const trading = tradingOutput ? sessionFromPrf(tradingOutput) : await derive(rpId, credential, "trading");
  const record = { credential, owner: owner.address, trading: trading.address };
  owner.session.end();
  trading.session.end();
  return record;
}

/**
 * Existing passkey on this or another device → the same two addresses, in one prompt where WebAuthn evaluates two PRF
 * salts at once (#41); otherwise a second prompt for the owner salt.
 */
export async function signIn(rpId: string, onStage?: (stage: KeyStage) => void): Promise<CurbAccountRecord> {
  onStage?.("both");
  const dual = dualSaltClient(SALTS.owner);
  const { prfOutput, credentialId } = await getPasskeyPrfOutput({ rpId, prfSalt: SALTS.trading, webAuthnClient: dual.client });
  const trading = sessionFromPrf(prfOutput);
  const credential: PasskeyCredentialMetadata = { credentialId };
  const ownerOutput = dual.second();
  if (!ownerOutput) onStage?.("owner");
  const owner = ownerOutput ? sessionFromPrf(ownerOutput) : await derive(rpId, credential, "owner");
  const record = { credential, owner: owner.address, trading: trading.address };
  owner.session.end();
  trading.session.end();
  return record;
}

/**
 * Run `fn` with the owner key, then destroy it. One biometric prompt per call, by design:
 * the owner key exists only for the moment money moves (BRIEF §10).
 */
export async function withOwnerKey<T>(
  rpId: string,
  record: CurbAccountRecord,
  fn: (account: LocalAccount) => Promise<T>,
): Promise<T> {
  const owner = await derive(rpId, record.credential, "owner");
  try {
    if (owner.address !== record.owner) throw new Error("This passkey does not match the account on this device");
    return await fn(toViemAccount(owner.session));
  } finally {
    owner.session.end();
  }
}

export type TradingSession = { address: Address; account: LocalAccount; end: () => void };

/**
 * Unlock the trading key for this session: one biometric prompt, then orders and cancels sign without asking.
 * The key lives only in this tab's memory (never stored, CLAUDE.md rule 7) until `end()` or a reload.
 */
export async function openTradingSession(rpId: string, record: CurbAccountRecord): Promise<TradingSession> {
  const trading = await derive(rpId, record.credential, "trading");
  if (trading.address !== record.trading) {
    trading.session.end();
    throw new Error("This passkey does not match the account on this device");
  }
  return { address: trading.address, account: toViemAccount(trading.session), end: () => trading.session.end() };
}
