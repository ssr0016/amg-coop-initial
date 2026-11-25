"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowLeft, Search, ShoppingBag, Truck, Sprout, Package, Coffee, Cookie, LayoutGrid, Plus } from "lucide-react";
import { money, nextStatuses, orderTotal, type Order, type Product, type Store, type User } from "../lib/models";
import { cancelOrder, checkout, setQuantity } from "../lib/storage";
import { Empty, Status, useAction } from "./shared";

const categories = [
  ["All products", LayoutGrid], ["Fresh produce", Sprout], ["Pantry", Package],
  ["Beverages", Coffee], ["Snacks", Cookie],
] as const;

function Photo({ product, sizes }: { product: Product; sizes: string }) {
  return <div className="product-photo">
    {product.image ? <Image src={product.image} alt="" fill sizes={sizes} unoptimized /> : <Package size={50} aria-hidden />}
    {product.stock === 0 && <span className="out">Out of stock</span>}
  </div>;
}

function Add({ product, user, compact = false }: { product: Product; user?: User; compact?: boolean }) {
  const act = useAction();
  const label = compact ? `Add ${product.name} to cart` : "Add to cart";
  const icon = compact ? <Plus size={20} aria-hidden /> : <ShoppingBag size={18} aria-hidden />;
  if (!product.stock || user?.role === "admin") return null;
  const className = compact ? "icon-button" : "button";
  return user ? <button type="button" className={className} aria-label={label}
    onClick={() => act(() => setQuantity(product.id, "add"), "Added to your cart.")}>{icon}{!compact && label}</button> :
    <Link href="/login" className={className} aria-label={compact ? `Sign in to add ${product.name}` : undefined}>{icon}{!compact && "Sign in to shop"}</Link>;
}

export function Catalog({ products, user }: { products: Product[]; user?: User }) {
  const [category, setCategory] = useState("All products");
  const [search, setSearch] = useState("");
  const term = search.toLowerCase().trim();
  const shown = products.filter((product) => (category === "All products" || product.category === category) &&
    `${product.name} ${product.category}`.toLowerCase().includes(term));
  const extra = [...new Set(products.map((product) => product.category))].filter((name) => !categories.some(([item]) => item === name));
  return <div className="wrap">
    <section className="hero">
      <div className="hero-content">
        <p className="eyebrow"><Sprout size={18} aria-hidden /> THE COOPERATIVE MARKET</p>
        <h1>Good food.<br />Grown together.</h1>
        <p>Philippine produce and pantry staples for your everyday table.</p>
        <a href="#catalog" className="button hero-button">Browse products <ArrowDown size={17} aria-hidden /></a>
      </div>
      <div className="hero-photo"><Image src="/images/market.webp" alt="A woven basket filled with fresh vegetables" fill preload sizes="(max-width: 680px) 100vw, 58vw" unoptimized /></div>
    </section>
    <section id="catalog" className="catalog">
      <div className="catalog-head">
        <div><h2>Shop the market</h2><p className="muted">Find fresh produce and Filipino pantry favorites.</p></div>
        <label className="search"><Search size={19} aria-hidden />
          <input aria-label="Search products" type="search" placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      <div className="catalog-controls">
        <div className="categories" aria-label="Product categories">
          {[...categories, ...extra.map((name) => [name, Package] as const)].map(([name, Icon]) =>
            <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}>
              <Icon size={16} aria-hidden />{name}
            </button>)}
        </div>
        <span className="muted text-sm" aria-live="polite">{shown.length} {shown.length === 1 ? "product" : "products"}</span>
      </div>
      {shown.length ? <div className="product-grid">{shown.map((product) => <article className="product-card" key={product.id}>
        <Link href={`/products/${product.id}`} aria-label={`View ${product.name}`}><Photo product={product} sizes="(max-width: 680px) 50vw, (max-width: 950px) 33vw, 25vw" /></Link>
        <div className="product-copy">
          <p className="product-category">{product.category}</p>
          <h3><Link href={`/products/${product.id}`}>{product.name}</Link></h3>
          <div className="product-price"><p><strong>{money(product.price)}</strong> <span>/ {product.unit}</span></p><Add product={product} user={user} compact /></div>
        </div>
      </article>)}</div> : <Empty action={<button className="button secondary" type="button" onClick={() => { setSearch(""); setCategory("All products"); }}>Clear filters</button>}>No products match your search.</Empty>}
    </section>
  </div>;
}

export function ProductDetail({ product, user }: { product?: Product; user?: User }) {
  return <section className="wrap inner">
    <Link className="back" href="/#catalog"><ArrowLeft size={17} aria-hidden /> Back to shop</Link>
    {product ? <div className="detail-grid">
      <Photo product={product} sizes="(max-width: 680px) 100vw, 50vw" />
      <div className="detail-copy">
        <p className="product-category">{product.category}</p><h1>{product.name}</h1><p className="muted">{product.description}</p>
        <p className="detail-price">{money(product.price)} <span>/ {product.unit}</span></p>
        {product.stock > 0 && <p className="muted">{product.stock} in stock</p>}
        <Add product={product} user={user} />
      </div>
    </div> : <Empty>This product is no longer available.</Empty>}
  </section>;
}

const codLabel = "Cash on Delivery / Pay to Admin";

export function Basket({ store, user, checkoutMode }: { store: Store; user: User; checkoutMode: boolean }) {
  const act = useAction();
  const [placed, setPlaced] = useState(false);
  const entries = Object.entries(store.carts[user.id] ?? {}).map(([id, quantity]) => ({
    id, quantity, product: store.products.find((product) => product.id === id),
  }));
  const items = entries.flatMap(({ product, quantity }) => product ? [{ productId: product.id, name: product.name, price: product.price, quantity }] : []);
  const valid = entries.every(({ product, quantity }) => product && quantity <= product.stock);
  const title = checkoutMode ? "Checkout" : "Your cart";
  return <section className="wrap inner">
    <Link href={checkoutMode ? "/cart" : "/#catalog"} className="back"><ArrowLeft size={17} aria-hidden /> {checkoutMode ? "Back to cart" : "Continue shopping"}</Link>
    <h1>{title}</h1>
    {placed ? <div className="panel stack mt-6"><h2>Order placed.</h2><div><Status value="pending_payment" /></div><p className="muted">You can follow your order in your order history.</p><div><Link className="button" href="/orders">View my orders <ArrowRight size={17} aria-hidden /></Link></div></div> :
      !entries.length ? <Empty action={<Link className="button" href="/#catalog">Browse products</Link>}>Your cart is empty.</Empty> :
      <div className="purchase-grid">
        <div className="panel stack">
          <h2>{checkoutMode ? "Order summary" : "Items in your cart"}</h2>
          {entries.map(({ id, quantity, product }) => <div key={id} className="line-item">
            <div><strong>{product?.name ?? "Removed product"}</strong>
              <p className="muted text-sm">{product ? `${money(product.price)} / ${product.unit}` : "No longer available"}</p>
              {product && quantity > product.stock && <p className="error-text text-sm">Only {product.stock} in stock</p>}
            </div>
            {checkoutMode ? <span>× {quantity}</span> : <div className="line-controls">
              {product && product.stock > 0 && <input aria-label={`Quantity for ${product.name}`} className="quantity" type="number" min="1" max={product.stock}
                value={quantity} onChange={(event) => { if (event.target.value) act(() => setQuantity(id, Number(event.target.value))); }} />}
              <button type="button" className="text-link" onClick={() => act(() => setQuantity(id, 0), "Item removed.")}>Remove</button>
            </div>}
          </div>)}
        </div>
        <aside className="panel stack">
          <h2>{checkoutMode ? "Payment" : "Order total"}</h2>
          {checkoutMode && <div className="callout stack"><div className="flex items-center gap-2"><Truck size={20} aria-hidden /><strong>{codLabel}</strong></div><p className="whitespace-pre-wrap">{store.settings.paymentInstructions}</p></div>}
          <div className="total"><span>Total</span><strong>{money(orderTotal(items))}</strong></div>
          {!valid && <p className="error-text">Update unavailable items in your cart before placing an order.</p>}
          {checkoutMode ? <button className="button" type="button" disabled={!valid}
            onClick={() => { if (act(checkout)) setPlaced(true); }}>Place order <ArrowRight size={17} aria-hidden /></button> :
            valid && <Link className="button" href="/checkout">Checkout <ArrowRight size={17} aria-hidden /></Link>}
        </aside>
      </div>}
  </section>;
}

export function OrderLines({ order }: { order: Order }) {
  return <ul className="order-lines">{order.items.map((item) => <li key={item.productId}>
    <span>{item.name} × {item.quantity}</span><span>{money(orderTotal([item]))}</span>
  </li>)}</ul>;
}
export const orderCode = (id: string) => `ANI-${id.slice(0, 8).toUpperCase()}`;
export const orderDate = (date: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(date));

export function History({ orders }: { orders: Order[] }) {
  const act = useAction();
  return <section className="wrap inner">
    <h1>My orders</h1>
    <p className="muted mt-2">Track your cooperative orders and payments.</p>
    <div className="stack mt-6">{orders.length ? orders.map((order) => <article className="panel stack" key={order.id}>
      <div className="row">
        <div><h2>{orderCode(order.id)}</h2><p className="muted text-sm">{orderDate(order.createdAt)}</p></div>
        <div className="row-actions">
          <Status value={order.status} />
          {nextStatuses[order.status].includes("cancelled") && <button type="button" className="button secondary" onClick={() => {
            if (window.confirm("Are you sure you want to cancel this order?")) {
              act(() => cancelOrder(order.id), "Order cancelled.");
            }
          }}>Cancel Order</button>}
        </div>
      </div>
      <OrderLines order={order} /><div className="total"><span>Order total</span><strong>{money(order.total)}</strong></div>
      {order.payment_reference && <p className="muted text-sm">Payment reference: {order.payment_reference}</p>}
    </article>) : <Empty action={<Link className="button" href="/#catalog">Browse products</Link>}>You haven’t placed any orders yet.</Empty>}</div>
  </section>;
}
