"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowRight, ArrowLeft, Search, ShoppingBag, Truck, Sprout, Package, Plus,
  ShoppingBasket, House, Backpack, Calculator, SoapDispenserDroplet, Gift, Pause, Play,
} from "lucide-react";
import { money, nextStatuses, orderTotal, productCategories, type Order, type Product, type Store, type User } from "../lib/models";
import { cancelOrder, checkout, setQuantity } from "../lib/storage";
import { Empty, Status, useAction } from "./shared";

const categories = ["All", ...productCategories];
const categoryIcons = {
  "Food Products": ShoppingBasket,
  "Household Products": House,
  "School Supplies": Backpack,
  "Office Supplies": Calculator,
  Essentials: SoapDispenserDroplet,
  Souvenirs: Gift,
};
const pageSize = 8;

function Photo({ product, sizes }: { product: Product; sizes: string }) {
  const image = product.image_url ?? product.image;
  return <div className="product-photo">
    {image ? <Image src={image} alt="" fill sizes={sizes} unoptimized /> : <Package size={50} aria-hidden />}
    {product.stock === 0 && <span className="out">Out of Stock</span>}
  </div>;
}

function Add({ product, user, compact = false }: { product: Product; user?: User; compact?: boolean }) {
  const act = useAction();
  const label = compact ? `Add ${product.name} to cart` : "Add to cart";
  const icon = compact ? <Plus size={20} aria-hidden /> : <ShoppingBag size={18} aria-hidden />;
  const soldOut = product.stock === 0;
  if (!soldOut && user?.role === "admin") return null;
  const className = compact ? "icon-button" : "button";
  return user || soldOut ? <button type="button" className={className} aria-label={label} disabled={soldOut}
    onClick={() => act(() => setQuantity(product.id, "add"), "Added to your cart.")}>{icon}{!compact && label}</button> :
    <Link href="/login" className={className} aria-label={compact ? `Sign in to add ${product.name}` : undefined}>{icon}{!compact && "Sign in to shop"}</Link>;
}

const heroSlides = [
  {
    category: "Food Products",
    description: "Stock your pantry with rice, Benguet coffee, and other co-op favorites.",
    image: "/images/hero-food.webp",
  },
  {
    category: "Household Products",
    description: "Find soft cotton towels, dish soap, and supplies for everyday chores.",
    image: "/images/hero-household.webp",
  },
  {
    category: "School Supplies",
    description: "Pack notebooks and colored pencils for class, homework, and creative projects.",
    image: "/images/hero-school-supplies.webp",
  },
  {
    category: "Office Supplies",
    description: "Keep your desk stocked with staplers, calculators, and tools for paperwork.",
    image: "/images/hero-office.webp",
  },
  {
    category: "Essentials",
    description: "Pick up handcrafted bath soap, reusable water bottles, and daily staples.",
    image: "/images/hero-essentials.webp",
  },
  {
    category: "Souvenirs",
    description: "Take home a colorful mug or canvas tote, or pick one up as a gift.",
    image: "/images/hero-souvenirs.webp",
  },
] satisfies { category: (typeof productCategories)[number]; description: string; image: string }[];

function Hero() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const respectMotionPreference = () => {
      if (motion.matches) setPaused(true);
    };
    respectMotionPreference();
    motion.addEventListener("change", respectMotionPreference);
    return () => motion.removeEventListener("change", respectMotionPreference);
  }, []);

  useEffect(() => {
    if (paused || hovered) return;
    const timer = window.setTimeout(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [activeSlide, paused, hovered]);

  return <section className="hero" aria-label="Featured categories" aria-roledescription="carousel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={(event) => {
      if (event.target.matches(":focus-visible")) setPaused(true);
    }}>
    <div className="hero-content">
      <p className="eyebrow"><Sprout size={18} aria-hidden /> THE COOPERATIVE MARKET</p>
      <div className="hero-copy" aria-live={paused || hovered ? "polite" : "off"} aria-atomic="true">
        {heroSlides.map((slide, index) => (
          <div key={slide.category} className="hero-slide" data-active={index === activeSlide} aria-hidden={index !== activeSlide}>
            <h1>{slide.category}</h1>
            <p>{slide.description}</p>
          </div>
        ))}
      </div>
      <a href="#catalog" className="button hero-button">Browse products <ArrowDown size={17} aria-hidden /></a>
    </div>
    <div className="hero-photo">
      {heroSlides.map((slide, index) => (
        <Image key={slide.category} className="hero-slide" data-active={index === activeSlide}
          src={slide.image} alt="" fill preload={index === 0} fetchPriority={index === 0 ? undefined : "low"}
          sizes="(max-width: 700px) calc(100vw - 32px), (max-width: 1304px) 54vw, 670px" />
      ))}
      <div className="hero-controls" role="group" aria-label="Slideshow controls">
        <button type="button" aria-label={paused ? "Play slideshow" : "Pause slideshow"} onClick={() => setPaused(!paused)}>
          {paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}
        </button>
        {heroSlides.map((slide, index) => (
          <button key={slide.category} type="button" className="hero-dot"
            aria-label={"Show " + slide.category} aria-current={index === activeSlide ? "true" : undefined}
            onClick={() => setActiveSlide(index)} />
        ))}
      </div>
    </div>
  </section>;
}

export function Catalog({ products, user }: { products: Product[]; user?: User }) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const catalogHeading = useRef<HTMLHeadingElement>(null);
  const term = search.toLowerCase().trim();
  const shown = products.filter((product) => (category === "All" || product.category === category) &&
    product.name.toLowerCase().includes(term));
  const pageCount = Math.ceil(shown.length / pageSize);
  const currentPage = Math.min(page, Math.max(1, pageCount));
  const start = (currentPage - 1) * pageSize;
  return <div className="wrap">
    <Hero />
    <section className="category-shortcuts" aria-labelledby="category-shortcuts-heading">
      <h2 id="category-shortcuts-heading">Shop by category</h2>
      <div className="category-shortcuts-grid">
        {productCategories.map((name) => {
          const Icon = categoryIcons[name];
          return <button key={name} type="button" aria-controls="catalog" aria-pressed={category === name}
            onClick={() => {
              setCategory(name);
              setSearch("");
              setPage(1);
              catalogHeading.current?.focus();
            }}>
            <Icon size={23} aria-hidden />
            {name}
          </button>;
        })}
      </div>
    </section>
    <section id="catalog" className="catalog">
      <div className="catalog-head">
        <h2 ref={catalogHeading} tabIndex={-1}>Shop the market</h2>
        <label className="search">
          Search products
          <span className="search-field"><Search size={19} aria-hidden />
            <input type="search" placeholder="Product name" value={search} onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }} />
          </span>
        </label>
      </div>
      <div className="catalog-controls">
        <div className="categories" role="group" aria-label="Product categories">
          {categories.map((name) =>
            <button key={name} type="button" aria-pressed={category === name} onClick={() => { setCategory(name); setPage(1); }}>
              {name}
            </button>)}
        </div>
        <span className="muted text-sm" aria-live="polite">{shown.length} {shown.length === 1 ? "product" : "products"}</span>
      </div>
      {shown.length ? <div className="product-grid">{shown.slice(start, start + pageSize).map((product) => <article className="product-card" key={product.id}>
        <Link href={`/products/${product.id}`} aria-label={`View ${product.name}`}><Photo product={product} sizes="(max-width: 680px) 50vw, (max-width: 950px) 33vw, 25vw" /></Link>
        <div className="product-copy">
          <p className="product-category">{product.category}</p>
          <h3><Link href={`/products/${product.id}`}>{product.name}</Link></h3>
          <div className="product-price"><p><strong>{money(product.price)}</strong> <span>/ {product.unit}</span></p><Add product={product} user={user} compact /></div>
        </div>
      </article>)}</div> : <Empty action={<button className="button secondary" type="button" onClick={() => { setSearch(""); setCategory("All"); setPage(1); }}>Clear filters</button>}>No products match your search.</Empty>}
      {pageCount > 1 && <nav className="pagination" aria-label="Product pages">
        <button className="button secondary" type="button" disabled={currentPage === 1}
          onClick={() => setPage(currentPage - 1)}>Prev</button>
        <span className="muted text-sm" role="status">Page {currentPage} of {pageCount}</span>
        <button className="button secondary" type="button" disabled={currentPage === pageCount}
          onClick={() => setPage(currentPage + 1)}>Next</button>
      </nav>}
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
export const orderCode = (id: string) => `AMG-${id.slice(0, 8).toUpperCase()}`;
export const orderDate = (date: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(date));

export function History({ orders, instructions }: { orders: Order[]; instructions: string }) {
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
      <details>
        <summary className="text-link order-summary">View order details</summary>
        <div className="stack mt-2">
          <OrderLines order={order} />
          <div className="total"><span>Order total</span><strong>{money(order.total)}</strong></div>
          <div className="callout">
            <h3 className="font-bold">Payment instructions</h3>
            <p className="text-sm">{codLabel}</p>
            <p className="mt-2 whitespace-pre-wrap">{instructions}</p>
          </div>
          {order.payment_reference && <p className="muted text-sm">Payment reference: {order.payment_reference}</p>}
        </div>
      </details>
    </article>) : <Empty action={<Link className="button" href="/#catalog">Browse products</Link>}>You haven’t placed any orders yet.</Empty>}</div>
  </section>;
}
