import { OrderDetailView } from "@/components/account/orders";

export default async function AccountOrderPage({ params }: PageProps<"/account/orders/[number]">) {
  const { number } = await params;
  return <OrderDetailView number={decodeURIComponent(number)} />;
}
