"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ClipboardList, LayoutDashboard, Package, Settings as SettingsIcon, Users, Plus } from "lucide-react";
import { money, nextStatuses, productCategories, statuses, statusLabel, type Order, type OrderStatus, type Product, type Store } from "../lib/models";
import { deleteProduct, reviewMember, saveInstructions, saveProduct, updateOrder } from "../lib/storage";
import { Empty, Status, useAction } from "./shared";
import { Analytics } from "./analytics";
import { orderCode, orderDate, OrderLines } from "./shop";

const tabs = [
  ["/admin", "Overview", LayoutDashboard], ["/admin/members", "Members", Users],
  ["/admin/products", "Products", Package], ["/admin/orders", "Orders", ClipboardList],
  ["/admin/settings", "Settings", SettingsIcon],
] as const;
const pages: Record<string, string> = {
  admin: "Dashboard", "admin/members": "Members", "admin/products": "Products",
  "admin/orders": "Orders", "admin/settings": "Settings",
};

export function Admin({ path, store }: { path: string; store: Store }) {
  const revenue = store.orders.filter((order) => order.status === "paid" || order.status === "completed")
    .reduce((sum, order) => sum + Math.round(order.total * 100), 0) / 100;
  const pending = store.users.filter((user) => user.role === "member" && user.status === "pending").length;
  return <section className="wrap admin-wrap">
    <aside><p className="product-category admin-menu-label">MARKET ADMIN</p>
      <nav aria-label="Admin navigation" className="admin-nav">{tabs.map(([href, label, Icon]) =>
        <Link key={href} href={href} aria-current={href === `/${path}` ? "page" : undefined}><Icon size={18} aria-hidden />{label}</Link>)}</nav>
    </aside>
    <div className="admin-content">
      <h1>{pages[path]}</h1>
      {path === "admin" && <>
        <p className="muted mt-2">Track cooperative orders, payments, and member approvals.</p>
        <div className="metrics">
          <div className="panel"><p>Total Revenue</p><strong>{money(revenue)}</strong></div>
          <div className="panel"><p>Pending Orders</p><strong>{store.orders.filter((order) => order.status === "pending_payment").length}</strong></div>
          <div className="panel"><p>Total Approved Members</p><strong>{store.users.filter((user) => user.role === "member" && user.status === "approved").length}</strong></div>
          <div className="panel"><p>Low Stock Alerts</p><strong>{store.products.filter((product) => product.stock < 5).length}</strong></div>
        </div>
        <Analytics orders={store.orders} products={store.products} />
        <div className="panel stack"><h2>Member approvals</h2><p className="muted">{pending ? `${pending} ${pending === 1 ? "application is" : "applications are"} waiting for review.` : "No pending members."}</p><div><Link href="/admin/members" className="text-link">Review members</Link></div></div>
      </>}
      {path === "admin/members" && <Members store={store} />}
      {path === "admin/products" && <Products products={store.products} />}
      {path === "admin/orders" && <Orders store={store} />}
      {path === "admin/settings" && <PaymentSettings instructions={store.settings.paymentInstructions} />}
    </div>
  </section>;
}

function Members({ store }: { store: Store }) {
  const act = useAction();
  const members = store.users.filter((user) => user.role === "member");
  return <div className="stack mt-6">
    {!members.some((user) => user.status === "pending") && <p className="callout">No pending members.</p>}
    {[...members].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending")).map((user) =>
      <article key={user.id} className="panel row">
        <div><h2>{user.name}</h2><p className="muted text-sm break-all">{user.email}</p><p className="muted text-sm">{user.memberId} · {user.contact}</p></div>
        <div className="row-actions">
          <span className={`status member-${user.status}`}>{user.status[0].toUpperCase() + user.status.slice(1)}</span>
          {user.status === "pending" && <>
            <button type="button" className="button secondary" onClick={() => act(() => reviewMember(user.id, "rejected"), "Member rejected.")}>Reject</button>
            <button type="button" className="button" onClick={() => act(() => reviewMember(user.id, "approved"), "Member approved.")}>Approve</button>
          </>}
        </div>
      </article>)}
  </div>;
}

const blank: Product = { id: "", name: "", category: productCategories[0], description: "", stock: 0, price: 0, image: "", unit: "" };

function ProductForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const act = useAction();
  const fileInput = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(product.image_url);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const preview = imageUrl ?? product.image;

  function readPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      window.alert("This image is too large. Choose a file that is 2 MB or smaller.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      window.alert("Choose an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setReadingPhoto(false);
      if (typeof reader.result === "string") setImageUrl(reader.result);
      else window.alert("This image could not be read. Choose another file.");
    };
    setReadingPhoto(true);
    reader.readAsDataURL(file);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readingPhoto) return;
    const form = new FormData(event.currentTarget);
    const read = (key: string) => String(form.get(key) ?? "").trim();
    const updated = { ...product, name: read("name"), description: read("description"), category: read("category"),
      unit: read("unit"), price: Number(read("price")), stock: Number(read("stock")), image_url: imageUrl };
    if (act(() => saveProduct(updated), "Product saved.")) onClose();
  }

  return <form className="panel stack" onSubmit={submit}>
    <h2>{product.id ? "Edit product" : "Add product"}</h2>
    <div className="field-grid">
      <label>Product name<input name="name" defaultValue={product.name} required maxLength={100} /></label>
      <label>Category<select name="category" defaultValue={product.category} required>
        {productCategories.map((category) => <option key={category}>{category}</option>)}
      </select></label>
      <label>Price (PHP)<input name="price" type="number" min="0.01" max="1000000" step="0.01" defaultValue={product.price || ""} required /></label>
      <label>Stock<input name="stock" type="number" min="0" max="1000000" step="1" defaultValue={product.stock} required /></label>
      <label>Unit<input name="unit" placeholder="e.g. 250 g" defaultValue={product.unit} required maxLength={35} /></label>
    </div>
    <div className="field"><label htmlFor="product-description">Description</label><textarea id="product-description" name="description" rows={3} defaultValue={product.description} required maxLength={500} /></div>
    <div className="field">
      <p id="photo-hint" className="muted text-sm">Images up to 2 MB.</p>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={readPhoto} />
      <div><button type="button" className="button secondary" aria-describedby="photo-hint" disabled={readingPhoto}
        onClick={() => fileInput.current?.click()}>Choose Image</button></div>
      {readingPhoto && <p className="muted text-sm" role="status">Reading image…</p>}
      {preview && <img className="product-photo-preview" src={preview} alt="Product photo preview" />}
    </div>
    <div className="row-actions">
      <button className="button" disabled={readingPhoto}>Save product</button>
      <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
    </div>
  </form>;
}

function Products({ products }: { products: Product[] }) {
  const act = useAction();
  const [editing, setEditing] = useState<Product>();
  const [confirm, setConfirm] = useState<string>();
  return <div className="stack mt-6">
    {!editing && <div><button type="button" className="button" onClick={() => { setConfirm(undefined); setEditing(blank); }}><Plus size={17} aria-hidden /> Add product</button></div>}
    {editing && <ProductForm key={editing.id} product={editing} onClose={() => setEditing(undefined)} />}
    {products.length ? products.map((product) => <article className="panel row" key={product.id}>
      <div><h2>{product.name}</h2><p className="muted text-sm">{product.category} · {money(product.price)} / {product.unit} · {product.stock} in stock</p></div>
      <div className="row-actions">{confirm === product.id ? <>
        <button type="button" className="button secondary" onClick={() => setConfirm(undefined)}>Cancel</button>
        <button type="button" className="button danger" onClick={() => {
          if (act(() => deleteProduct(product.id), "Product deleted.")) {
            setConfirm(undefined);
            if (editing?.id === product.id) setEditing(undefined);
          }
        }}>Confirm delete</button>
      </> : <>
        <button type="button" className="button secondary" onClick={() => setEditing(product)}>Edit</button>
        <button type="button" className="button secondary" onClick={() => setConfirm(product.id)}>Delete</button>
      </>}</div>
    </article>) : <Empty>No products in the catalog.</Empty>}
  </div>;
}

function Orders({ store }: { store: Store }) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string>();
  const shown = store.orders.filter((order) => !filter || order.status === filter);
  return <div className="stack mt-6">
    <div className="field max-w-xs"><label htmlFor="status-filter">Filter by status</label><select id="status-filter" value={filter} onChange={(event) => { setFilter(event.target.value); setSelected(undefined); }}>
      <option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}
    </select></div>
    {shown.length ? shown.map((order) => {
      const member = store.users.find((user) => user.id === order.userId);
      return <article className="panel stack" key={order.id}>
        <div className="row">
          <div><h2>{orderCode(order.id)}</h2><p className="muted text-sm">{member?.name ?? "Member"} · {orderDate(order.createdAt)}</p><p>{money(order.total)}</p></div>
          <div className="row-actions"><Status value={order.status} /><button type="button" className="button secondary" aria-expanded={selected === order.id}
            onClick={() => setSelected(selected === order.id ? undefined : order.id)}>{selected === order.id ? "Hide order" : "View order"}</button></div>
        </div>
        {selected === order.id && <OrderForm key={`${order.id}-${order.status}`} order={order} contact={member?.contact} />}
      </article>;
    }) : <Empty>{filter ? "No orders match this status." : "No orders have been placed yet."}</Empty>}
  </div>;
}

function OrderForm({ order, contact }: { order: Order; contact?: string }) {
  const act = useAction();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = form.get("status") as OrderStatus;
    act(() => updateOrder(order.id, status, String(form.get("reference") ?? "").trim(),
      String(form.get("notes") ?? "").trim(), order.status), "Order updated.");
  }
  return <form className="stack order-form" onSubmit={submit}>
    <OrderLines order={order} />
    <p className="muted text-sm">Cash on Delivery / Pay to Admin{contact ? ` · ${contact}` : ""}</p>
    <div className="field-grid">
      <div className="field"><label htmlFor="order-status">Order status</label><select id="order-status" name="status" defaultValue={order.status}>
        {[order.status, ...nextStatuses[order.status]].map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}
      </select></div>
      <label>Payment reference<input name="reference" defaultValue={order.payment_reference} maxLength={100} /></label>
    </div>
    <div className="field"><label htmlFor="order-notes">Admin notes</label><textarea id="order-notes" name="notes" defaultValue={order.admin_notes} maxLength={1000} rows={3} /></div>
    <div><button className="button">Save order</button></div>
  </form>;
}

function PaymentSettings({ instructions }: { instructions: string }) {
  const act = useAction();
  return <form className="panel stack mt-6" onSubmit={(event) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("instructions") ?? "");
    act(() => saveInstructions(value), "Payment instructions saved.");
  }}>
    <h2>Checkout payment</h2>
    <p className="muted">Members see these instructions when they place a Cash on Delivery order.</p>
    <div className="field"><label htmlFor="payment-instructions">Payment instructions</label><textarea id="payment-instructions" key={instructions} name="instructions" defaultValue={instructions} rows={5} required maxLength={1200} /></div>
    <div><button className="button">Save instructions</button></div>
  </form>;
}
