"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { ShoppingBag, ArrowUpRight } from "lucide-react";
import { currentUser, getStore, logout, seedStore, subscribe } from "../lib/storage";
import { seed } from "../lib/seed";
import { Admin } from "./admin";
import { Account } from "./account";
import { Basket, Catalog, History, PaymentDetails, ProductDetail } from "./shop";
import { PendingLabel, usePendingAction } from "./shared";

const serverSnapshot = () => null;

export function Market({ path }: { path: string }) {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribe, getStore, serverSnapshot);
  const store = snapshot ?? seed;
  const user = snapshot ? currentUser(store) : undefined;
  const memberOrders = user?.role === "member" ? store.orders.filter((order) => order.userId === user.id) : [];
  const activeOrderCount = memberOrders.filter(({ status }) =>
    status === "pending_payment" || status === "confirmed" || status === "paid").length;
  const cartCount = Object.values(user ? store.carts[user.id] ?? {} : {}).reduce((sum, count) => sum + count, 0);
  const { pending, run } = usePendingAction();
  const signedOut = useRef(false);
  const [section, id] = path.split("/");
  const role = section === "admin" ? "admin" : ["cart", "checkout", "orders", "payment-details"].includes(section) ? "member" : null;
  const blocked = role && user?.role !== role;

  useEffect(seedStore, []);
  useEffect(() => {
    if (snapshot && blocked && !signedOut.current) router.replace("/login");
  }, [snapshot, blocked, router]);

  let body: ReactNode;
  if (blocked) body = <div className="wrap py-20" role="status">Redirecting…</div>;
  else if (path.startsWith("admin")) body = <Admin path={path} store={store} />;
  else if (path === "login" || path === "register") body = <Account registerMode={path === "register"} ready={snapshot !== null} />;
  else if (path === "cart" || path === "checkout") body = <Basket store={store} user={user!} checkoutMode={path === "checkout"} />;
  else if (path === "orders") body = <History orders={memberOrders} instructions={store.settings.paymentInstructions} />;
  else if (section === "payment-details") body = <PaymentDetails settings={store.settings} orderId={id} order={memberOrders.find((order) => order.id === id)} />;
  else if (section === "products") body = !snapshot ? <div className="wrap py-20" role="status">Loading product…</div> : <ProductDetail product={store.products.find((product) => product.id === id)} user={user} />;
  else body = <Catalog products={store.products} user={user} />;

  return <>
    <a className="skip" href="#main">Skip to content</a>
    <header className="site-header bg-white">
      <div className="demo-strip"><span aria-hidden />DEMO MODE — data saved in your browser only</div>
      <div className="wrap nav-row flex-col py-3 md:flex-row md:py-0">
        <Link href="/" className="brand max-w-full text-center [overflow-wrap:anywhere]">AMG Co-op Market</Link>
        <nav aria-label="Main navigation" className="nav-links w-full min-w-0 justify-center gap-x-3 gap-y-1 md:w-auto md:justify-end md:gap-x-6">
          <Link href="/" aria-current={!path ? "page" : undefined}>Shop</Link>
          {user?.role === "admin" && <Link href="/admin" aria-current={role === "admin" ? "page" : undefined}>Admin</Link>}
          {user?.role === "member" && <>
            <Link href="/orders" aria-current={path === "orders" ? "page" : undefined}>
              My orders
              {activeOrderCount > 0 && <span className="nav-count">
                {activeOrderCount}<span className="sr-only"> active {activeOrderCount === 1 ? "order" : "orders"}</span>
              </span>}
            </Link>
            <Link href="/cart" aria-label={`Cart (${cartCount})`}><ShoppingBag size={17} aria-hidden /> <span>Cart</span> <span className="nav-count">{cartCount}</span></Link>
          </>}
          {user ? <button type="button" className="nav-sign" disabled={Boolean(pending)} onClick={() => run(() => {
            logout();
            signedOut.current = true;
            router.push("/");
          }, "Signed out.")}>{pending ? <PendingLabel>Signing out…</PendingLabel> : "Sign out"}</button> :
            <Link href="/login" className="nav-sign">Sign in <ArrowUpRight size={15} aria-hidden /></Link>}
        </nav>
      </div>
    </header>
    <main id="main">{body}</main>
    <footer>
      <p className="wrap footer-row">© 2026 AMG Co-op Market. All rights reserved. | Philippine Cooperative Market · Demo Storefront</p>
    </footer>
  </>;
}
