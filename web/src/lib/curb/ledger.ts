import type { Address, Hash } from "viem";
import type { Attempt } from "@/lib/curb/refusal";
import type { Side } from "@/lib/lane";

/**
 * What this device sent for a Curb account, in order. Kuru's events carry no indexed fields, so an account's own
 * activity can't be queried by address; the app keeps the hashes it sent and re-reads every status from the chain.
 * Public data only (hashes, prices, sizes); nothing secret. Stored per account, per device.
 */
export type LedgerEntry =
  | { kind: "created"; hash: Hash; at: number }
  | { kind: "deposit"; hash: Hash; at: number; token: Address; amount: string }
  | {
      kind: "order";
      hash: Hash;
      at: number;
      side: Side;
      price: string;
      size: string;
      /** The id Kuru gave the resting remainder, or null when the order filled completely on arrival. */
      orderId: string | null;
      /** Size filled on arrival (this account as taker). */
      takerFill: string;
      /** The lane when it was placed (price units), to draw the order against. */
      lane?: { bid: string; ask: string; minSell: string; maxBuy: string };
    }
  | { kind: "cancel"; hash: Hash; at: number; orderIds: string[] }
  /** A resting order of this account filled (in part or whole) by someone else's transaction, seen while Curb was open. */
  | { kind: "fill"; hash: Hash; at: number; orderId: string; size: string; block: string }
  /** The owner key moved money out of the account's Kuru margin. */
  | { kind: "withdraw"; hash: Hash; at: number; token: Address; amount: string; to: Address }
  /** The owner key sent MON from itself (gas for the trading key, or anywhere else). */
  | { kind: "send"; hash: Hash; at: number; amount: string; to: Address }
  /** A transaction the chain refused, with the decoded reason. */
  | { kind: "refused"; hash: Hash; at: number; attempt: Attempt; signer: "owner" | "trading"; error: string | null; detail: string };

const key = (account: Address) => `curb.ledger.v1:${account.toLowerCase()}`;

export function readLedger(account: Address): LedgerEntry[] {
  try {
    const raw = localStorage.getItem(key(account));
    return raw ? (JSON.parse(raw) as LedgerEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendLedger(account: Address, ...entries: LedgerEntry[]) {
  const current = readLedger(account);
  // A transaction is recorded once per kind and order, however many times it is seen.
  const seen = new Set(current.map(ledgerKey));
  const fresh = entries.filter((e) => !seen.has(ledgerKey(e)));
  if (fresh.length === 0) return;
  const next = [...current, ...fresh];
  try {
    localStorage.setItem(key(account), JSON.stringify(next));
  } catch {
    // Storage blocked: the chain still has the transaction; only this device's list misses it.
  }
  window.dispatchEvent(new Event("curb-ledger"));
}

function ledgerKey(e: LedgerEntry): string {
  return e.kind === "fill" ? `fill:${e.hash}:${e.orderId}` : `${e.kind}:${e.hash}`;
}

export function subscribeLedger(listener: () => void) {
  window.addEventListener("curb-ledger", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("curb-ledger", listener);
    window.removeEventListener("storage", listener);
  };
}

/** Order ids placed from this device and not cancelled from it: candidates for Open orders (checked onchain). */
export function trackedOrderIds(entries: LedgerEntry[]): string[] {
  const cancelled = new Set(entries.flatMap((e) => (e.kind === "cancel" ? e.orderIds : [])));
  return entries.flatMap((e) => (e.kind === "order" && e.orderId && !cancelled.has(e.orderId) ? [e.orderId] : []));
}

/**
 * Cancels sent from this tab and not yet recorded. The book can show an order gone a block before its cancel's receipt
 * is handled; while its id is here, the order reads as cancelling rather than as having left the book unexplained.
 */
let cancelling: ReadonlySet<string> = new Set();
const cancellingListeners = new Set<() => void>();

export function setCancelling(ids: readonly string[], on: boolean) {
  const next = new Set(cancelling);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  cancelling = next;
  for (const l of cancellingListeners) l();
}

/** The ids in flight, as an immutable snapshot (a new set on every change). */
export const cancellingSnapshot = () => cancelling;

export function subscribeCancelling(listener: () => void) {
  cancellingListeners.add(listener);
  return () => cancellingListeners.delete(listener);
}
