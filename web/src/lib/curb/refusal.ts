import { decodeErrorResult, type Hash, type Hex, type PublicClient } from "viem";
import { curbAccountAbi } from "@/lib/curb/abi";
import { formatPrice } from "@/lib/format";
import { kuruErrorsAbi } from "@/lib/kuru/abi";
import type { Market } from "@/lib/markets/registry";
import { perplErrorsAbi } from "@/lib/perpl/abi";

// No error name appears twice across the three (checked 2026-10-03), so a decode names exactly one source.
const errorsAbi = [...curbAccountAbi, ...kuruErrorsAbi, ...perplErrorsAbi] as const;
const curbErrorNames: ReadonlySet<string> = new Set(curbAccountAbi.flatMap((e) => (e.type === "error" ? [e.name] : [])));
const kuruErrorNames: ReadonlySet<string> = new Set(kuruErrorsAbi.map((e) => e.name));
const perplErrorNames: ReadonlySet<string> = new Set(perplErrorsAbi.map((e) => e.name));

/**
 * Who stopped a transaction, from its error's name alone (History keeps only the name). A venue's error means Curb's
 * account had already let the call through, since its own checks run first.
 */
export function refusedBy(error: string | null): Refusal["by"] {
  if (error === null) return "unknown";
  if (curbErrorNames.has(error)) return "curb";
  if (kuruErrorNames.has(error)) return "kuru";
  if (perplErrorNames.has(error)) return "perpl";
  return "unknown";
}

/** The one word for what happened (D-032, #77): the Curb account refuses; a venue, or a revert with no reason, rejects. */
export const verdict = (by: Refusal["by"]) => (by === "curb" ? "Refused" : "Rejected");

/** What the key was trying to do, which decides the signage ("NO WITHDRAWAL" only makes sense for a withdrawal). */
export type Attempt = "order" | "withdraw" | "cancel";

export type Refusal = {
  /** The error's name, decoded from the revert data; null when the chain didn't give one back. */
  error: string | null;
  /** Who refused: Curb's account (the product's rules), or the venue (Kuru's or Perpl's rules). */
  by: "curb" | "kuru" | "perpl" | "unknown";
  /** Stencil signage, one line per entry (BRIEF §5, §11). */
  signage: readonly string[];
  title: string;
  body: string;
  /** OffLane only: the curb price the contract enforced at that block (price units). */
  limit?: bigint;
  /** LeverageAboveCap only: the cap the contract enforced, in hundredths (500 = 5x). */
  capHdths?: number;
};

/** Turn a transaction's revert data into the reason shown to the person, in the product's words. */
export function explainRefusal(data: Hex | null | undefined, attempt: Attempt, market: Market): Refusal {
  const p = (x: bigint | number) => formatPrice(BigInt(x), market.pricePrecision);
  let decoded: ReturnType<typeof decodeErrorResult<typeof errorsAbi>> | null = null;
  if (data && data !== "0x") {
    try {
      decoded = decodeErrorResult({ abi: errorsAbi, data });
    } catch {
      decoded = null;
    }
  }
  const curb = (signage: readonly string[], title: string, body: string, extra: Partial<Refusal> = {}): Refusal => ({
    error: decoded?.errorName ?? null,
    by: "curb",
    signage,
    title,
    body,
    ...extra,
  });
  // Kuru and Perpl reject; only Curb's account refuses (DESIGN.md: red is the account's refusal, nothing else).
  const kuru = (body: string): Refusal => ({ error: decoded?.errorName ?? null, by: "kuru", signage: [], title: "Kuru rejected it.", body });
  const perpl = (body: string): Refusal => ({ error: decoded?.errorName ?? null, by: "perpl", signage: [], title: "Perpl rejected it.", body });
  const times = (hdths: bigint | number) => `${(Number(hdths) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}×`;

  switch (decoded?.errorName) {
    case "OffLane": {
      const [isBuy, price, limit] = decoded.args;
      return curb(
        ["OFF-BOOK"],
        "Off the lane. Your Curb account refused it.",
        isBuy
          ? `A buy at ${p(price)} is past the curb: at that block the most a buy could pay was ${p(limit)}, Kuru's best ask + 0.50%.`
          : `A sell at ${p(price)} is past the curb: at that block the least a sell could take was ${p(limit)}, Kuru's best bid − 0.50%.`,
        { limit: BigInt(limit) },
      );
    }
    case "NotOwner":
      return curb(
        attempt === "withdraw" ? ["NO", "WITHDRAWAL"] : ["OWNER", "KEY ONLY"],
        "Your Curb account refused it.",
        attempt === "withdraw"
          ? "Only the owner key can move money out. The trading key asked; the account said no, and nothing moved."
          : "Only the owner key can do this.",
      );
    case "NotTrader":
      return curb(["REFUSED"], "Your Curb account refused it.", "This key isn't the account's trading key, so it can't place orders.");
    case "NotOwnerOrTrader":
      return curb(["REFUSED"], "Your Curb account refused it.", "Only the account's own two keys can cancel its orders.");
    case "MarketNotAllowed":
      return curb(["NO", "ENTRY"], "Your Curb account refused it.", "This market isn't one the account allows its trading key to use.");
    case "NoMarket":
      return curb(["NO", "LANE"], "Your Curb account refused it.", "Kuru's book was empty on one side or crossed at that block, so there was no lane to trade in.");
    case "NotOnTick":
      return curb(["REFUSED"], "Your Curb account refused it.", "The price wasn't on Kuru's tick: prices move in steps of 0.000001.");
    case "ZeroPrice":
      return curb(["REFUSED"], "Your Curb account refused it.", "A price of zero isn't a price.");
    case "TransferFailed":
      return curb(["REFUSED"], "The transfer didn't go through.", "The address it was sent to wouldn't accept it. Nothing moved.");
    case "ZeroAddress":
      return curb(["REFUSED"], "Your Curb account refused it.", "It can't send to the zero address.");
    case "PerpOffLane": {
      const [, isBuy, price, limit] = decoded.args;
      return curb(
        ["OFF-BOOK"],
        "Off the lane. Your Curb account refused it.",
        isBuy
          ? `A bid at ${p(price)} is past the curb: at that block the most it could pay was ${p(limit)}, Perpl's best ask + 0.50%.`
          : `An ask at ${p(price)} is past the curb: at that block the least it could take was ${p(limit)}, Perpl's best bid − 0.50%.`,
        { limit: BigInt(limit) },
      );
    }
    case "LeverageAboveCap": {
      const [leverage, cap] = decoded.args;
      return curb(
        // The stencil face has no multiplication sign; a road sign would read "MAX 5X" anyway.
        ["MAX", times(cap).replace("×", "X")],
        "Over your leverage cap. Your Curb account refused it.",
        `The trading key asked for ${times(leverage)}; your cap on this market is ${times(cap)}. Only the owner key can raise it.`,
        { capHdths: Number(cap) },
      );
    }
    case "PerpNotAllowed":
      return curb(["NO", "ENTRY"], "Your Curb account refused it.", "This perpetual isn't one the account allows its trading key to use.");
    case "PerpNoMarket":
      return curb(["NO", "LANE"], "Your Curb account refused it.", "Perpl's book was empty on one side or crossed at that block, so there was no lane to trade in.");
    case "PerpOrderNotAllowed":
      return curb(["REFUSED"], "Your Curb account refused it.", "The trading key may only open or close positions, with no collateral attached.");
    case "PostOnlyError":
      return kuru("The order would have traded straight away, and Curb sent it post-only so it couldn't. Nothing traded.");
    case "InsufficientBalance":
      return kuru("Your account's money on Kuru doesn't cover this order.");
    case "SizeError":
      return kuru(`The size is below Kuru's minimum of ${(market.minSize / market.sizePrecision).toString()} ${market.base.symbol}.`);
    case "Unauthorized":
      return kuru("Kuru didn't accept the caller.");
    case "CrossesBook":
      return perpl("A post-only order would have crossed the book, so Perpl didn't post it. Nothing traded.");
    case "InsufficientFunds":
    case "AmountExceedsAvailableBalance":
      return perpl("The account's AUSD on Perpl doesn't cover this order's margin.");
    case "CloseOrderExceedsPosition":
    case "OrderSizeExceedsAvailableSize":
      return perpl("The close is larger than the open position.");
    case "TakerOrderSettlementFailed":
      // Perpl settles a taker only against a reference price under refPriceMaxAgeSec (60 s for MON) old (CONTEXT.md).
      return perpl("Perpl couldn't settle it against the book just then: it needs a reference price under a minute old. Nothing traded; try again in a moment.");
    default:
      if (decoded && perplErrorNames.has(decoded.errorName)) return perpl(`One of Perpl's own checks stopped it. Nothing traded.`);
      return {
        error: null,
        by: "unknown",
        signage: [],
        title: "It reverted onchain.",
        body: "The transaction reverted, and the chain didn't give back a reason Curb can read. The transaction page has the details.",
      };
  }
}

type CallTrace = { error?: string; output?: Hex };

/**
 * The revert data of a mined transaction. Receipts don't carry it, so it comes from the node's call tracer, which the
 * public Monad RPC serves (verified 2026-10-03). Null when the call didn't revert or the node won't trace it.
 */
export async function revertDataOf(client: PublicClient, hash: Hash): Promise<Hex | null> {
  try {
    const trace = await client.request<{ Parameters: [Hash, { tracer: "callTracer" }]; ReturnType: CallTrace }>({
      method: "debug_traceTransaction",
      params: [hash, { tracer: "callTracer" }],
    });
    return trace.error && trace.output && trace.output !== "0x" ? trace.output : null;
  } catch {
    return null;
  }
}

/** What a mined transaction cost its signer. Monad charges the gas limit, and its receipts report that as gasUsed. */
export const feePaid = (receipt: { gasUsed: bigint; effectiveGasPrice: bigint }) => receipt.gasUsed * receipt.effectiveGasPrice;
