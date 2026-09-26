import { EmptyLane } from "@/components/curb/empty-state";

export const metadata = { title: "History · Curb" };

export default function HistoryPage() {
  return (
    <EmptyLane eyebrow="HISTORY" title="Nothing has happened yet.">
      Every trade, cancel, deposit, withdrawal and refusal lands here with the key that signed it and a link to the
      transaction on Monad. Nothing is shown until it is onchain.
    </EmptyLane>
  );
}
