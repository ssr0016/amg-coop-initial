import { notFound } from "next/navigation";
import { Market } from "../../components/market";

const routes = ["", "login", "register", "cart", "checkout", "orders", "admin",
  "admin/members", "admin/products", "admin/orders", "admin/settings"];

export default async function Page({ params }: { params: Promise<{ route?: string[] }> }) {
  const { route = [] } = await params;
  const path = route.join("/");
  if (!routes.includes(path) && !(route[0] === "products" && route.length === 2)) notFound();
  return <Market key={path} path={path} />;
}
