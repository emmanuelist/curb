import { EmptyLane } from "@/components/curb/empty-state";

export const metadata = { title: "More · Curb" };

export default function MorePage() {
  return (
    <EmptyLane eyebrow="MORE" title="About Curb.">
      <p>
        Curb trades on Kuru, the fully onchain order book on Monad. One passkey gives you two keys: an owner key, the
        only key that can move money out, and a trading key that places and cancels orders inside the lane without a
        prompt.
      </p>
      <p className="mt-4">
        The lane is Kuru&apos;s live best bid and ask, plus or minus half a percent. Your Curb account checks the same
        line onchain, so an order outside it is refused by the contract, not just by this app.
      </p>
    </EmptyLane>
  );
}
