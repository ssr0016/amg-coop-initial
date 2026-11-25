"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Leaf, ShoppingBag, ArrowUpRight, Check } from "lucide-react";
import { currentUser, getStore, logout, seedStore, subscribe } from "../lib/storage";
import { seed } from "../lib/seed";
import { Admin } from "./admin";
import { Account } from "./account";
import { Basket, Catalog, History, ProductDetail } from "./shop";
import { ActionContext } from "./shared";

const serverSnapshot = () => null;

function Brand() {
  return <Link href="/" className="brand"><span className="brand-mark"><Leaf size={21} aria-hidden /></span><span>AMG<span className="brand-secondary"> Co-op Market</span></span></Link>;
}

export function Market({ path }: { path: string }) {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribe, getStore, serverSnapshot);
  const store = snapshot ?? seed;
  const user = snapshot ? currentUser(store) : undefined;
  const cartCount = Object.values(user ? store.carts[user.id] ?? {} : {}).reduce((sum, count) => sum + count, 0);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean; dismissAfterMs?: number }>();
  const role = path.startsWith("admin") ? "admin" : ["cart", "checkout", "orders"].includes(path) ? "member" : null;
  const blocked = role && user?.role !== role;

  useEffect(seedStore, []);
  useEffect(() => {
    if (snapshot && blocked) router.replace("/login");
  }, [snapshot, blocked, router]);

  useEffect(() => {
    if (feedback?.dismissAfterMs === undefined) return;
    const timer = window.setTimeout(() => {
      setFeedback((current) => current === feedback ? undefined : current);
    }, feedback.dismissAfterMs);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function act(action: () => void, message?: string, dismissAfterMs?: number) {
    try {
      action();
      setFeedback(message ? { text: message, error: false, dismissAfterMs } : undefined);
      return true;
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : "Please try again.", error: true });
      return false;
    }
  }

  let body: ReactNode;
  if (blocked) body = <div className="wrap py-20" role="status">Opening sign in…</div>;
  else if (path.startsWith("admin")) body = <Admin path={path} store={store} />;
  else if (path === "login" || path === "register") body = <Account registerMode={path === "register"} ready={snapshot !== null} />;
  else if (path === "cart" || path === "checkout") body = <Basket store={store} user={user!} checkoutMode={path === "checkout"} />;
  else if (path === "orders") body = <History orders={store.orders.filter((order) => order.userId === user!.id)} instructions={store.settings.paymentInstructions} />;
  else if (path.startsWith("products/")) body = !snapshot ? <div className="wrap py-20" role="status">Loading product…</div> : <ProductDetail product={store.products.find((product) => product.id === path.split("/")[1])} user={user} />;
  else body = <Catalog products={store.products} user={user} />;

  return <ActionContext.Provider value={act}>
    <a className="skip" href="#main">Skip to content</a>
    <header className="site-header">
      <div className="demo-strip"><span aria-hidden />DEMO MODE — data saved in your browser only</div>
      <div className="wrap nav-row">
        <Brand />
        <nav aria-label="Main navigation" className="nav-links">
          <Link href="/" aria-current={!path ? "page" : undefined}>Shop</Link>
          {user?.role === "admin" && <Link href="/admin" aria-current={role === "admin" ? "page" : undefined}>Admin</Link>}
          {user?.role === "member" && <>
            <Link href="/orders" aria-current={path === "orders" ? "page" : undefined}>My orders</Link>
            <Link href="/cart" className="nav-cart" aria-label={`Cart (${cartCount})`}><ShoppingBag size={17} aria-hidden /> <span>Cart</span> <b>{cartCount}</b></Link>
          </>}
          {user ? <button type="button" className="nav-sign" onClick={() => { if (act(logout)) router.push("/"); }}>Sign out</button> :
            <Link href="/login" className="nav-sign">Sign in <ArrowUpRight size={15} aria-hidden /></Link>}
        </nav>
      </div>
    </header>
    <main id="main">{body}</main>
    <div className="notifications" aria-live="polite" aria-atomic="true">
      {feedback && <div className={`notice ${feedback.error ? "bg-[#8d3025]" : "bg-(--forest)"}`}>
        <span className="flex items-center gap-2">
          {!feedback.error && <Check className="size-4 shrink-0" aria-hidden />}
          {feedback.text}
        </span>
        <button type="button" aria-label="Dismiss message" onClick={() => setFeedback(undefined)}>×</button>
      </div>}
    </div>
    <footer><div className="wrap footer-row"><Brand /><span>Philippine cooperative market · Demo storefront</span></div></footer>
  </ActionContext.Provider>;
}
