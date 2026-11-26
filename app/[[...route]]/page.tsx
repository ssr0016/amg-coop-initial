import { notFound } from "next/navigation";
import { Market } from "../../components/market";

const routes = ["", "login", "register", "cart", "checkout", "orders", "payment-details", "admin",
  "admin/members", "admin/products", "admin/orders", "admin/settings"];

export default async function Page({ params }: { params: Promise<{ route?: string[] }> }) {
  const { route = [] } = await params;
  const path = route.join("/");
  if (!routes.includes(path) && !(route.length === 2 && ["products", "payment-details"].includes(route[0]))) notFound();
  return <Market key={path} path={path} />;
}
