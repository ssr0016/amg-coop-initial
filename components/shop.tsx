"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowDown, ArrowRight, ArrowLeft, Search, ShoppingBag, Truck, Sprout, Package, Plus,
  ShoppingBasket, House, Backpack, Calculator, SoapDispenserDroplet, Gift, Pause, Play,
} from "lucide-react";
import {
  canRequestReturn, canSubmitPaymentReference, money, nextStatuses, orderTotal, paymentTypeLabel, preferredResolutionLabels, productCategories,
  returnDetailsMaxLength, returnPhotoMaxBytes, returnPhotoTypes, returnReasons,
  type Order, type Product, type Settings, type Store, type User,
} from "../lib/models";
import { cancelOrder, cancelReturnRequest, checkout, completeOrder, requestReturn, setQuantity, submitPaymentReference } from "../lib/storage";
import { Empty, OrderResolution, OrderStatusBadges, PendingLabel, Status, useAction, usePendingAction } from "./shared";

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
    {product.stock < 5 && <div className="stock-badges">
      <span>Low Stock</span>
      {product.stock === 0 && <span>Out of Stock</span>}
    </div>}
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
        <label className="search w-full sm:max-w-[305px]">
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
      {shown.length ? <div className="product-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{shown.slice(start, start + pageSize).map((product) => <article className="product-card" key={product.id}>
        <Link href={`/products/${product.id}`} aria-label={`View ${product.name}, ${product.stock} in stock`}><Photo product={product} sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" /></Link>
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
    {product ? <div className="detail-grid grid grid-cols-1 md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
      <Photo product={product} sizes="(min-width: 768px) 50vw, 100vw" />
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
const paymentDetailsPath = "/payment-details";

export function Basket({ store, user, checkoutMode }: { store: Store; user: User; checkoutMode: boolean }) {
  const act = useAction();
  const { pending, run } = usePendingAction();
  const [placedOrderId, setPlacedOrderId] = useState<string>();
  const entries = Object.entries(store.carts[user.id] ?? {}).map(([id, quantity]) => ({
    id, quantity, product: store.products.find((product) => product.id === id),
  }));
  const items = entries.flatMap(({ product, quantity }) => product ? [{ productId: product.id, name: product.name, price: product.price, quantity }] : []);
  const valid = entries.every(({ product, quantity }) => product && quantity <= product.stock);
  const title = checkoutMode ? "Checkout" : "Your cart";
  return <section className="wrap inner">
    <Link href={checkoutMode ? "/cart" : "/#catalog"} className="back"><ArrowLeft size={17} aria-hidden /> {checkoutMode ? "Back to cart" : "Continue shopping"}</Link>
    <h1>{title}</h1>
    {placedOrderId ? <div className="panel stack mt-6">
      <h2>Order placed.</h2>
      <div><Status value="pending_payment" /></div>
      <div className="row-actions">
        <Link className="button" href={`${paymentDetailsPath}/${placedOrderId}`}>View Payment Details</Link>
        <Link className="button secondary" href="/orders">View my orders <ArrowRight size={17} aria-hidden /></Link>
      </div>
    </div> :
      !entries.length ? <Empty action={<Link className="button" href="/#catalog">Browse products</Link>}>Your cart is empty.</Empty> :
      <div className="purchase-grid grid grid-cols-1 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="panel stack">
          <h2>{checkoutMode ? "Order summary" : "Items in your cart"}</h2>
          {entries.map(({ id, quantity, product }) => <div key={id} className="line-item">
            <div><strong>{product?.name ?? "Removed product"}</strong>
              <p className="muted text-sm">{product ? `${money(product.price)} / ${product.unit}` : "No longer available"}</p>
              {product && quantity > product.stock && <p className="error-text text-sm">Only {product.stock} in stock</p>}
            </div>
            {checkoutMode ? <span>× {quantity}</span> : <div className="line-controls w-full sm:w-auto">
              {product && product.stock > 0 && <input aria-label={`Quantity for ${product.name}`} className="quantity" type="number" min="1" max={product.stock}
                value={quantity} onChange={(event) => { if (event.target.value) act(() => setQuantity(id, Number(event.target.value))); }} />}
              <button type="button" className="text-link w-full sm:w-auto" onClick={() => act(() => setQuantity(id, 0), "Item removed.")}>Remove</button>
            </div>}
          </div>)}
        </div>
        <aside className="panel stack">
          <h2>{checkoutMode ? "Payment" : "Order total"}</h2>
          {checkoutMode && <div className="callout stack">
            <div className="flex items-center gap-2"><Truck size={20} className="shrink-0" aria-hidden /><strong>{codLabel}</strong></div>
            <p className="whitespace-pre-wrap">{store.settings.paymentInstructions}</p>
            <div><Link className="button secondary w-full sm:w-auto" href={paymentDetailsPath}>View Payment Details</Link></div>
          </div>}
          <div className="total"><span>Total</span><strong>{money(orderTotal(items))}</strong></div>
          {!valid && <p className="error-text">Update unavailable items in your cart before placing an order.</p>}
          {checkoutMode ? <button className="button" type="button" disabled={!valid || Boolean(pending)}
            onClick={() => run(() => {
              setPlacedOrderId(checkout());
            }, "Order placed successfully!")}>
            {pending ? <PendingLabel>Processing...</PendingLabel> : <>Place order <ArrowRight size={17} aria-hidden /></>}
          </button> :
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

export function PaymentDetails({ settings, orderId, order }: { settings: Settings; orderId?: string; order?: Order }) {
  const act = useAction();
  const backPath = orderId ? "/orders" : "/checkout";
  const methods = settings.paymentMethods.filter(({ accountName, accountNumber }) => accountName && accountNumber);
  const [accountId, setAccountId] = useState(order?.paymentAccount?.id ?? "");
  const availableAccountId = methods.some((method) => method.id === accountId) ? accountId : "";
  const awaitingConfirmation = order && canSubmitPaymentReference(order);

  return <section className="wrap inner max-w-2xl">
    <Link href={backPath} className="back"><ArrowLeft size={17} aria-hidden /> {orderId ? "Back to my orders" : "Back to checkout"}</Link>
    <h1>Payment Details</h1>
    {orderId && !order ? <Empty>This order is unavailable.</Empty> : <div className="stack mt-6">
      <div className="panel stack">
        {order && <div className="row">
          <div><h2>{orderCode(order.id)}</h2><p className="muted">Order total <strong>{money(order.total)}</strong></p></div>
          <OrderStatusBadges order={order} />
        </div>}
        {order && <OrderResolution order={order} />}
        <div className="callout">
          <p className="font-bold">{codLabel}</p>
          <p className="mt-2 whitespace-pre-wrap">{settings.paymentInstructions}</p>
        </div>
        {methods.length > 0 ? <section className="stack">
          <h2>Payment methods</h2>
          {methods.map((method) => <div key={method.id} className="flex flex-col items-start justify-between gap-4 border-t border-(--border) pt-4 sm:flex-row">
            <div className="min-w-0 wrap-anywhere">
              <h3 className="mb-2 text-lg font-bold">{paymentTypeLabel(method)}</h3>
              <dl className="grid gap-2">
                <div><dt className="muted text-sm">Account name</dt><dd>{method.accountName}</dd></div>
                <div><dt className="muted text-sm">Account number</dt><dd className="font-bold">{method.accountNumber}</dd></div>
              </dl>
            </div>
            {method.qrCode && <figure className="mx-auto w-full max-w-[300px] shrink-0 sm:mx-0">
              <img className="h-auto w-full rounded-lg border border-gray-200 bg-white p-2" src={method.qrCode}
                alt={`Payment QR code for ${method.accountName} (${paymentTypeLabel(method)})`} referrerPolicy="no-referrer" />
              <figcaption className="muted mt-2 text-center text-sm">Scan this QR code using your GCash or Bank app.</figcaption>
            </figure>}
          </div>)}
        </section> : <p className="muted">The admin hasn’t added any payment accounts yet.</p>}
        {!order && methods.length > 0 && <p>Place your order before sending payment so you can submit the reference for that order.</p>}
      </div>
      {order?.payment_reference && <div className="callout">
        <p>Ref No: <strong>{order.payment_reference}</strong>{awaitingConfirmation && " · Awaiting admin confirmation"}</p>
        {order.paymentAccount && <p>Paid to: {paymentTypeLabel(order.paymentAccount)} - {order.paymentAccount.accountName}
          {" · "}{order.paymentAccount.accountNumber}</p>}
      </div>}
      {order && awaitingConfirmation && methods.length > 0 && <form className="panel stack" onSubmit={(event) => {
        event.preventDefault();
        const reference = String(new FormData(event.currentTarget).get("reference") ?? "");
        act(() => submitPaymentReference(order.id, availableAccountId, reference), "Payment reference submitted. Awaiting admin confirmation.");
      }}>
        <h2>Submit a payment reference</h2>
        <label>Account you paid
          <select value={availableAccountId} required onChange={(event) => setAccountId(event.target.value)}>
            <option value="" disabled>Choose a payment account</option>
            {methods.map((method) => <option key={method.id} value={method.id}>
              {paymentTypeLabel(method)} - {method.accountName} · {method.accountNumber}
            </option>)}
          </select>
        </label>
        <label>Payment Reference Number
          <input name="reference" key={order.payment_reference} defaultValue={order.payment_reference}
            placeholder="e.g. GCash Ref No." maxLength={100} required />
        </label>
        <div><button className="button w-full sm:w-auto">{order.payment_reference ? "Update Reference" : "Submit Payment Reference"}</button></div>
      </form>}
    </div>}
  </section>;
}

export function History({ orders, instructions }: { orders: Order[]; instructions: string }) {
  const { pending, run } = usePendingAction();
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState<{ order: Order; action: "receive" | "cancel" | "report" | "cancel-request" }>();
  const receiving = confirmation?.action === "receive";
  const cancellingRequest = confirmation?.action === "cancel-request";

  useEffect(() => {
    if (confirmation) dialog.current?.showModal();
  }, [confirmation]);

  function confirmOrderAction() {
    if (!confirmation) return;
    const { order } = confirmation;
    run(() => {
      try {
        if (receiving) completeOrder(order.id);
        else if (cancellingRequest) cancelReturnRequest(order);
        else cancelOrder(order.id);
      } finally {
        dialog.current?.close();
        heading.current?.focus({ preventScroll: true });
      }
    }, receiving ? "Order marked as completed." : cancellingRequest ? "Return request cancelled." : "Order cancelled successfully.");
  }

  return <section className="wrap inner">
    <h1 ref={heading} tabIndex={-1}>My orders</h1>
    <p className="muted mt-2">Track your cooperative orders and payments.</p>
    <div className="stack mt-6">{orders.length ? orders.map((order) => <article className="panel stack" key={order.id}>
      <div className="row">
        <div><h2>{orderCode(order.id)}</h2><time className="muted text-sm" dateTime={order.createdAt}>{orderDate(order.createdAt)}</time></div>
        <div className="row-actions">
          <OrderStatusBadges order={order} />
          {canSubmitPaymentReference(order) && <Link className="button secondary" href={`${paymentDetailsPath}/${order.id}`}>View Payment Details</Link>}
          {order.status === "paid" && <button type="button" className="button" aria-haspopup="dialog"
            onClick={() => setConfirmation({ order, action: "receive" })}>Order Received</button>}
          {nextStatuses[order.status].includes("cancelled") && <button type="button" className="button secondary" aria-haspopup="dialog"
            onClick={() => setConfirmation({ order, action: "cancel" })}>Cancel Order</button>}
        </div>
      </div>
      {order.items[0] && <p className="muted text-sm wrap-anywhere">
        {order.items[0].quantity} × {order.items[0].name}
        {order.items.length > 1 && ` + ${order.items.length - 1} more`}
      </p>}
      {order.payment_reference && <p className="muted text-sm wrap-anywhere">Payment reference: {order.payment_reference}
        {canSubmitPaymentReference(order) && " · Awaiting admin confirmation"}</p>}
      {order.status === "return_requested" && order.returnRequest?.adminMessage && <div className="callout">
        <p><strong>Admin requested you to return the item.</strong></p>
        <p className="mt-2 whitespace-pre-wrap">{order.returnRequest.adminMessage}</p>
      </div>}
      <details>
        <summary className="text-link order-summary">View order details</summary>
        <div className="stack mt-2">
          <OrderResolution order={order} />
          <OrderLines order={order} />
          <div className="total"><span>Order total</span><strong>{money(order.total)}</strong></div>
          <div className="callout">
            <h3 className="font-bold">Payment instructions</h3>
            <p className="text-sm">{codLabel}</p>
            <p className="mt-2 whitespace-pre-wrap">{instructions}</p>
          </div>
          {order.status === "completed" && (order.returnResolution?.note || order.returnResolution?.photo) && (
            <section className="callout">
              <h3 className="font-bold">Resolution Proof</h3>
              {order.returnResolution.note && <p className="mt-2 whitespace-pre-wrap">{order.returnResolution.note}</p>}
              {order.returnResolution.photo && (
                <img className="return-photo mt-2" src={order.returnResolution.photo} alt="Replacement item photo provided by the admin" />
              )}
            </section>
          )}
          {order.status === "cancelled" && (order.refund_note || order.refund_proof) && (
            <section className="callout">
              <h3 className="font-bold">Refund Confirmation</h3>
              {order.refund_note && <p className="mt-2 whitespace-pre-wrap wrap-anywhere">{order.refund_note}</p>}
              {order.refund_proof && <img className="return-photo mt-2" src={order.refund_proof} alt="Proof of refund provided by the admin" />}
            </section>
          )}
        </div>
      </details>
      {canRequestReturn(order) && <div>
        <button type="button" className="text-link underline" aria-haspopup="dialog"
          onClick={() => setConfirmation({ order, action: "report" })}>Report an issue</button>
      </div>}
      {order.status === "return_requested" && <div className="row-actions">
        <button type="button" className="button secondary" aria-haspopup="dialog"
          onClick={() => setConfirmation({ order, action: "report" })}>Edit Request</button>
        <button type="button" className="button neutral" aria-haspopup="dialog"
          onClick={() => setConfirmation({ order, action: "cancel-request" })}>Cancel Request</button>
      </div>}
    </article>) : <Empty action={<Link className="button" href="/#catalog">Browse products</Link>}>You haven’t placed any orders yet.</Empty>}</div>
    <dialog ref={dialog} aria-labelledby="order-action-title" aria-describedby="order-action-description"
      className="panel order-dialog"
      onCancel={(event) => { if (pending) event.preventDefault(); }}
      onClose={() => setConfirmation(undefined)}>
      {confirmation?.action === "report" ? <ReturnRequestForm order={confirmation.order}
        onClose={() => dialog.current?.close()} onSaved={() => {
          dialog.current?.close();
          heading.current?.focus({ preventScroll: true });
        }} /> : <div className="stack">
        <h2 id="order-action-title">{receiving ? "Order received?" : cancellingRequest ? "Cancel return request?" : "Cancel Order?"}</h2>
        <p id="order-action-description" className="muted">{receiving
          ? "Confirm that you received your order. This will mark it as completed."
          : cancellingRequest ? "This will withdraw your request and restore the order’s previous status."
            : "Are you sure you want to cancel this order? This action cannot be undone."}</p>
        <div className="row-actions justify-end">
          <button type="button" className="button neutral" disabled={Boolean(pending)}
            onClick={() => dialog.current?.close()}>{receiving ? "Go back" : cancellingRequest ? "Keep Request" : "Keep Order"}</button>
          <button type="button" className={receiving ? "button" : "button danger"} disabled={Boolean(pending)} onClick={confirmOrderAction}>
            {pending ? <PendingLabel>Processing...</PendingLabel> : receiving ? "Confirm Receipt" : cancellingRequest ? "Cancel Request" : "Yes, Cancel"}
          </button>
        </div>
      </div>}
    </dialog>
  </section>;
}

function ReturnRequestForm({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const act = useAction();
  const editing = order.status === "return_requested";
  const [photo, setPhoto] = useState(order.returnRequest?.photo);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [error, setError] = useState("");

  function readPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!returnPhotoTypes.includes(file.type) || !file.size || file.size > returnPhotoMaxBytes) {
      setError("Choose a JPEG, PNG, WebP, or GIF image up to 512 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setReadingPhoto(false);
      if (typeof reader.result === "string") setPhoto(reader.result);
      else setError("Could not read this photo. Choose another file.");
    };
    setError("");
    setReadingPhoto(true);
    reader.readAsDataURL(file);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readingPhoto) return;
    const form = new FormData(event.currentTarget);
    try {
      requestReturn(order, String(form.get("reason") ?? ""), String(form.get("preferredResolution") ?? ""),
        String(form.get("details") ?? ""), photo);
    } catch (error) {
      setError(error instanceof Error && error.name !== "QuotaExceededError"
        ? error.message : "Could not save your request. Try removing the photo or choosing a smaller one.");
      return;
    }
    act(onSaved, editing ? "Return request updated." : "Return request submitted. Admin will contact you shortly.");
  }

  return <form className="stack" onSubmit={submit}>
    <h2 id="order-action-title">{editing ? "Edit return request" : "Report an issue"}</h2>
    <label>Reason
      <select name="reason" defaultValue={order.returnRequest?.reason ?? ""} required>
        <option value="" disabled>Select a reason</option>
        {returnReasons.map((reason) => <option key={reason}>{reason}</option>)}
      </select>
    </label>
    <label>Preferred Resolution
      <select name="preferredResolution" defaultValue={order.returnRequest?.preferredResolution ?? ""} required>
        <option value="" disabled>Select a preferred resolution</option>
        {Object.entries(preferredResolutionLabels).map(([value, label]) =>
          <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label>Additional details (optional)
      <textarea name="details" defaultValue={order.returnRequest?.details} maxLength={returnDetailsMaxLength} rows={3} />
    </label>
    <div className="field">
      <label>{photo ? "Replace photo" : "Photo (optional)"}
        <input type="file" accept={returnPhotoTypes.join(",")} disabled={readingPhoto}
          aria-describedby="order-action-description" onChange={readPhoto} />
      </label>
      <p className="muted text-sm" id="order-action-description">JPEG, PNG, WebP, or GIF up to 512 KB.</p>
      {readingPhoto && <p className="muted text-sm" role="status">Reading photo…</p>}
      {photo && <div className="field">
        <img className="return-photo" src={photo} alt="Attached return request photo" />
        <div><button type="button" className="text-link underline" disabled={readingPhoto}
          onClick={() => { setPhoto(undefined); setError(""); }}>Remove photo</button></div>
      </div>}
    </div>
    {error && <p className="callout error-text" role="alert">{error}</p>}
    <div className="row-actions justify-end">
      <button type="button" className="button neutral" onClick={onClose}>Go back</button>
      <button className="button" disabled={readingPhoto}>{editing ? "Save changes" : "Submit return request"}</button>
    </div>
  </form>;
}
