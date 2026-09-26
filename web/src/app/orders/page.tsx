import { EmptyLane } from "@/components/curb/empty-state";

export const metadata = { title: "Orders · Curb" };

export default function OrdersPage() {
  return (
    <EmptyLane eyebrow="ORDERS" title="No orders yet." action={{ href: "/", label: "GO TO THE LANE" }}>
      Orders your trading key places on Kuru show up here, open, filled and cancelled, each drawn against the lane it
      was placed in.
    </EmptyLane>
  );
}
