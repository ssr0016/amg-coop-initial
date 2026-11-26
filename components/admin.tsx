"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ClipboardList, LayoutDashboard, Package, Settings as SettingsIcon, Users, Plus } from "lucide-react";
import { downloadCsv } from "../lib/csv";
import {
  canSubmitPaymentReference, money, nextStatuses, paymentQrMaxBytes, paymentQrTypes, paymentTypeLabel, productCategories, statuses, statusLabel,
  type Order, type OrderStatus, type PaymentMethod, type Product, type Settings, type Store, type User,
} from "../lib/models";
import { completeOrder, deleteProduct, reviewMember, savePaymentSettings, saveProduct, updateOrder } from "../lib/storage";
import { Empty, PendingLabel, Status, useAction, usePendingAction } from "./shared";
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
const exportMessage = "Export successful! File downloaded.";

type SalesPeriod = "all" | "month" | "week";
const manilaOffsetMs = 8 * 60 * 60 * 1000;

function salesInPeriod(orders: Order[], period: SalesPeriod) {
  const sales = orders.filter(({ status }) => status === "paid" || status === "completed" || status === "return_requested");
  if (period === "all") return sales;

  const now = Date.now();
  // Use UTC setters on Manila's local date so the browser's time zone cannot shift the boundary.
  const start = new Date(now + manilaOffsetMs);
  start.setUTCHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(period === "month" ? 1 : start.getUTCDate() - daysSinceMonday);
  const from = start.getTime() - manilaOffsetMs;
  return sales.filter(({ createdAt }) => {
    const created = Date.parse(createdAt);
    return created >= from && created <= now;
  });
}

export function Admin({ path, store }: { path: string; store: Store }) {
  const [period, setPeriod] = useState<SalesPeriod>("all");
  const salesOrders = salesInPeriod(store.orders, period);
  const revenue = salesOrders
    .reduce((sum, order) => sum + Math.round(order.total * 100), 0) / 100;
  const pending = store.users.filter((user) => user.role === "member" && user.status === "pending").length;
  return <section className="wrap admin-wrap grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)]">
    <aside><p className="product-category admin-menu-label">MARKET ADMIN</p>
      <nav aria-label="Admin navigation" className="admin-nav lg:flex-col">{tabs.map(([href, label, Icon]) =>
        <Link key={href} href={href} aria-current={href === `/${path}` ? "page" : undefined}><Icon size={18} aria-hidden />{label}</Link>)}</nav>
    </aside>
    <div className="admin-content">
      <h1>{pages[path]}</h1>
      {path === "admin" && <>
        <p className="muted mt-2">Track cooperative orders, payments, and member approvals.</p>
        <div className="field mt-4 sm:max-w-xs">
          <label htmlFor="sales-period">Sales period</label>
          <select id="sales-period" value={period} onChange={(event) => setPeriod(event.target.value as SalesPeriod)}>
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="week">This Week</option>
          </select>
        </div>
        <div className="metrics grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel"><p>Total Revenue</p><strong>{money(revenue)}</strong></div>
          <div className="panel"><p>Pending Orders</p><strong>{store.orders.filter((order) => order.status === "pending_payment").length}</strong></div>
          <div className="panel"><p>Total Approved Members</p><strong>{store.users.filter((user) => user.role === "member" && user.status === "approved").length}</strong></div>
          <div className="panel"><p>Low Stock Alerts</p><strong>{store.products.filter((product) => product.stock < 5).length}</strong></div>
        </div>
        <Analytics orders={store.orders} salesOrders={salesOrders} products={store.products} />
        <div className="panel stack"><h2>Member approvals</h2><p className="muted">{pending ? `${pending} ${pending === 1 ? "application is" : "applications are"} waiting for review.` : "No pending members."}</p><div><Link href="/admin/members" className="text-link">Review members</Link></div></div>
      </>}
      {path === "admin/members" && <Members store={store} />}
      {path === "admin/products" && <Products products={store.products} />}
      {path === "admin/orders" && <Orders store={store} />}
      {path === "admin/settings" && <PaymentSettings settings={store.settings} />}
    </div>
  </section>;
}

function Members({ store }: { store: Store }) {
  const act = useAction();
  const members = store.users.filter((user) => user.role === "member");
  return <div className="stack mt-6">
    <div><button type="button" className="button secondary w-full sm:w-auto" onClick={() => act(() => downloadCsv("members.csv",
      ["Member ID", "Name", "Email", "Contact", "Status"],
      members.map((user) => [user.memberId, user.name, user.email, user.contact, user.status])), exportMessage)}>
      Export Members (CSV)
    </button></div>
    {!members.some((user) => user.status === "pending") && <p className="callout">No pending members.</p>}
    {[...members].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending")).map((user) =>
      <MemberRow key={user.id} user={user} />)}
  </div>;
}

function MemberRow({ user }: { user: User }) {
  const { pending, run } = usePendingAction();
  return <article className="panel row">
    <div><h2>{user.name}</h2><p className="muted text-sm break-all">{user.email}</p><p className="muted text-sm">{user.memberId} · {user.contact}</p></div>
    <div className="row-actions">
      <span className={`status member-${user.status}`}>{user.status[0].toUpperCase() + user.status.slice(1)}</span>
      {user.status === "pending" && <>
        <button type="button" className="button secondary" disabled={Boolean(pending)}
          onClick={() => run(() => reviewMember(user.id, "rejected"), "Member rejected.", "reject")}>
          {pending === "reject" ? <PendingLabel>Processing...</PendingLabel> : "Reject"}
        </button>
        <button type="button" className="button" disabled={Boolean(pending)}
          onClick={() => run(() => reviewMember(user.id, "approved"), "Member approved.", "approve")}>
          {pending === "approve" ? <PendingLabel>Approving...</PendingLabel> : "Approve"}
        </button>
      </>}
    </div>
  </article>;
}

const blank: Product = { id: "", name: "", category: productCategories[0], description: "", stock: 0, price: 0, image: "", unit: "" };

function ProductForm({ product, saving, onSave, onClose }: {
  product: Product; saving: boolean; onSave: (product: Product) => void; onClose: () => void;
}) {
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
    if (readingPhoto || saving) return;
    const form = new FormData(event.currentTarget);
    const read = (key: string) => String(form.get(key) ?? "").trim();
    const updated = { ...product, name: read("name"), description: read("description"), category: read("category"),
      unit: read("unit"), price: Number(read("price")), stock: Number(read("stock")), image_url: imageUrl };
    onSave(updated);
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
      <div><button type="button" className="button secondary w-full sm:w-auto" aria-describedby="photo-hint" disabled={readingPhoto || saving}
        onClick={() => fileInput.current?.click()}>Choose Image</button></div>
      {readingPhoto && <p className="muted text-sm" role="status">Reading image…</p>}
      {preview && <img className="product-photo-preview" src={preview} alt="Product photo preview" />}
    </div>
    <div className="row-actions">
      <button className="button" disabled={readingPhoto || saving}>{saving ? <PendingLabel>Saving...</PendingLabel> : "Save product"}</button>
      <button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button>
    </div>
  </form>;
}

function Products({ products }: { products: Product[] }) {
  const act = useAction();
  const { pending, run } = usePendingAction();
  const saving = Boolean(pending);
  const [editing, setEditing] = useState<Product>();
  const [confirm, setConfirm] = useState<string>();
  return <div className="stack mt-6">
    <div className="row-actions">
      {!editing && <button type="button" className="button" onClick={() => { setConfirm(undefined); setEditing(blank); }}><Plus size={17} aria-hidden /> Add product</button>}
      <button type="button" className="button secondary" onClick={() => act(() => downloadCsv("inventory.csv",
        ["Product Name", "Category", "Price", "Stock", "Unit"],
        products.map((product) => [product.name, product.category, product.price, product.stock, product.unit])), exportMessage)}>
        Export Inventory (CSV)
      </button>
    </div>
    {editing && <ProductForm key={editing.id} product={editing} saving={saving} onClose={() => setEditing(undefined)}
      onSave={(product) => run(() => {
        saveProduct(product);
        setEditing(undefined);
      }, "Product saved successfully.")} />}
    {products.length ? products.map((product) => <article className="panel row" key={product.id}>
      <div><h2>{product.name}</h2><p className="muted text-sm">{product.category} · {money(product.price)} / {product.unit} · {product.stock} in stock</p></div>
      <div className="row-actions">{confirm === product.id ? <>
        <button type="button" className="button secondary" onClick={() => setConfirm(undefined)}>Cancel</button>
        <button type="button" className="button danger" disabled={saving} onClick={() => {
          if (act(() => deleteProduct(product.id), "Product deleted.")) {
            setConfirm(undefined);
            if (editing?.id === product.id) setEditing(undefined);
          }
        }}>Confirm delete</button>
      </> : <>
        <button type="button" className="button secondary" disabled={saving} onClick={() => setEditing(product)}>Edit</button>
        <button type="button" className="button secondary" disabled={saving} onClick={() => setConfirm(product.id)}>Delete</button>
      </>}</div>
    </article>) : <Empty>No products in the catalog.</Empty>}
  </div>;
}

function Orders({ store }: { store: Store }) {
  const act = useAction();
  const { pending, run } = usePendingAction();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string>();
  const statusFilter = useRef<HTMLSelectElement>(null);
  const shown = store.orders.filter((order) => !filter || order.status === filter);
  return <div className="stack mt-6">
    <div><button type="button" className="button secondary w-full sm:w-auto" onClick={() => act(() => downloadCsv("orders.csv",
      ["Order ID", "Date", "Member Name", "Total", "Status", "Payment Ref"],
      store.orders.map((order) => [order.id, order.createdAt,
        store.users.find((user) => user.id === order.userId)?.name, order.total, order.status, order.payment_reference])), exportMessage)}>
      Export Orders (CSV)
    </button></div>
    <div className="field sm:max-w-xs"><label htmlFor="status-filter">Filter by status</label><select ref={statusFilter} id="status-filter" value={filter} onChange={(event) => { setFilter(event.target.value); setSelected(undefined); }}>
      <option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}
    </select></div>
    {shown.length ? shown.map((order) => {
      const member = store.users.find((user) => user.id === order.userId);
      const completionKey = `complete:${order.id}`;
      const paymentKey = `pay:${order.id}`;
      const resolutionKey = `resolve:${order.id}`;
      return <article className="panel stack" key={order.id}>
        <div className="row">
          <div><h2>{orderCode(order.id)}</h2><p className="muted text-sm">{member?.name ?? "Member"} · {orderDate(order.createdAt)}</p><p>{money(order.total)}</p></div>
          <div className="row-actions">
            <Status value={order.status} />
            <button type="button" className="button secondary" aria-expanded={selected === order.id}
              onClick={() => setSelected(selected === order.id ? undefined : order.id)}>{selected === order.id ? "Hide order" : "View order"}</button>
            {order.status === "paid" && <button type="button" className="button" disabled={Boolean(pending)}
              onClick={() => run(() => completeOrder(order.id), "Order marked as completed.", completionKey)}>
              {pending === completionKey ? <PendingLabel>Completing...</PendingLabel> : "Mark as Completed"}
            </button>}
          </div>
        </div>
        {selected === order.id && <OrderForm key={`${order.id}-${order.status}`} order={order} contact={member?.contact}
          saving={pending === order.id} markingPaid={pending === paymentKey} resolving={pending === resolutionKey}
          disabled={Boolean(pending)} onSave={(status, reference, notes) => {
            const resolving = order.status === "return_requested" && status !== order.status;
            const message = resolving
              ? status === "cancelled" ? "Return resolved and order cancelled." : "Replacement marked as completed."
              : "Order updated.";
            run(() => {
              updateOrder(order, { status, payment_reference: reference, admin_notes: notes });
              if (resolving) statusFilter.current?.focus({ preventScroll: true });
            }, message, resolving ? resolutionKey : order.id);
          }} onMarkPaid={() => run(() => updateOrder(order, { status: "paid" }), "Order marked as paid.", paymentKey)} />}
      </article>;
    }) : <Empty>{filter ? "No orders match this status." : "No orders have been placed yet."}</Empty>}
  </div>;
}

function OrderForm({ order, contact, saving, markingPaid, resolving, disabled, onSave, onMarkPaid }: {
  order: Order; contact?: string; saving: boolean; markingPaid: boolean; resolving: boolean; disabled: boolean;
  onSave: (status: OrderStatus, reference: string, notes: string) => void;
  onMarkPaid: () => void;
}) {
  const hasOpenReturn = order.status === "return_requested";
  const resolutionDialog = useRef<HTMLDialogElement>(null);
  const confirmResolution = useRef<(status: "cancelled" | "completed") => void>(undefined);

  function resolve(status: "cancelled" | "completed") {
    const confirm = confirmResolution.current;
    resolutionDialog.current?.close();
    confirm?.(status);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    const reference = String(form.get("reference") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    if (hasOpenReturn && form.has("resolve")) {
      confirmResolution.current = (status) => onSave(status, reference, notes);
      resolutionDialog.current?.showModal();
      return;
    }
    onSave((form.get("status") as OrderStatus | null) ?? order.status, reference, notes);
  }
  return <form className="stack order-form" onSubmit={submit}>
    <OrderLines order={order} />
    <p className="muted text-sm [overflow-wrap:anywhere]">Cash on Delivery / Pay to Admin{contact ? ` · ${contact}` : ""}</p>
    {hasOpenReturn && order.returnRequest && <div className="callout">
      <p><strong>{order.returnRequest.reason}</strong></p>
      {order.returnRequest.details && <p className="mt-2 whitespace-pre-wrap">{order.returnRequest.details}</p>}
      {order.returnRequest.photo && <img className="return-photo mt-2" src={order.returnRequest.photo} alt="Member’s return request photo" />}
    </div>}
    {(order.payment_reference || order.paymentAccount) && <div className="callout row">
      <div>
        {order.payment_reference && <p><strong>Ref No: {order.payment_reference}</strong></p>}
        {order.paymentAccount && <p>
          <strong>Paid to: {paymentTypeLabel(order.paymentAccount)} - {order.paymentAccount.accountName}</strong>
          {" · "}{order.paymentAccount.accountNumber}
        </p>}
        {order.payment_reference && canSubmitPaymentReference(order) && <p className="text-sm">Verify the transfer before marking the order as paid.</p>}
      </div>
      {order.payment_reference && canSubmitPaymentReference(order) && <button type="button" className="button w-full sm:w-auto" disabled={disabled}
        onClick={onMarkPaid}>{markingPaid ? <PendingLabel>Marking as paid…</PendingLabel> : "Mark as Paid"}</button>}
    </div>}
    <div className="field-grid">
      {!hasOpenReturn && <div className="field"><label htmlFor="order-status">Order status</label><select id="order-status" name="status" defaultValue={order.status}>
        {[order.status, ...nextStatuses[order.status]].map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}
      </select></div>}
      <label>Payment reference<input key={order.payment_reference} name="reference" defaultValue={order.payment_reference} maxLength={100} /></label>
    </div>
    <div className="field"><label htmlFor="order-notes">Admin notes</label><textarea id="order-notes" name="notes" defaultValue={order.admin_notes} maxLength={1000} rows={3} /></div>
    <div className="row-actions">
      <button className={`button${hasOpenReturn ? " secondary" : ""}`} disabled={disabled}>{saving ? <PendingLabel>Saving...</PendingLabel> : "Save order"}</button>
      {hasOpenReturn && <button className="button" name="resolve" aria-haspopup="dialog" disabled={disabled}>
        {resolving ? <PendingLabel>Resolving...</PendingLabel> : "Resolve Issue"}
      </button>}
    </div>
    {hasOpenReturn && <dialog ref={resolutionDialog} className="panel order-dialog"
      aria-labelledby="resolve-issue-title" aria-describedby="resolve-issue-description"
      onClose={() => { confirmResolution.current = undefined; }}>
      <div className="stack">
        <h2 id="resolve-issue-title">Resolve this issue?</h2>
        <p id="resolve-issue-description" className="muted">A refund cancels the order and returns its item quantities to inventory. Completing a replacement closes the request and keeps current stock levels.</p>
        <div className="row-actions justify-end">
          <button type="button" className="button neutral" onClick={() => resolutionDialog.current?.close()}>Go back</button>
        </div>
        <div className="row-actions justify-end">
          <button type="button" className="button danger" disabled={disabled} onClick={() => resolve("cancelled")}>Refund &amp; Restock</button>
          <button type="button" className="button" disabled={disabled} onClick={() => resolve("completed")}>Replacement Completed</button>
        </div>
      </div>
    </dialog>}
  </form>;
}

function PaymentSettings({ settings }: { settings: Settings }) {
  const act = useAction();
  const { pending, run } = usePendingAction();
  const [methods, setMethods] = useState(settings.paymentMethods);
  const [readingQr, setReadingQr] = useState<string>();

  function editMethod(id: string, fields: Partial<Omit<PaymentMethod, "id">>) {
    setMethods((current) => current.map((method) => method.id === id ? { ...method, ...fields } : method));
  }

  function readQr(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    act(() => {
      if (!paymentQrTypes.includes(file.type) || !file.size || file.size > paymentQrMaxBytes) {
        throw new Error("Choose a PNG, JPEG, WebP, or GIF image up to 1 MB.");
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setReadingQr(undefined);
        act(() => {
          if (typeof reader.result !== "string") throw new Error("The QR code image could not be read. Choose another file.");
          editMethod(id, { qrCode: reader.result });
        });
      };
      reader.readAsDataURL(file);
      setReadingQr(id);
    });
  }

  return <form className="panel stack mt-6" onSubmit={(event) => {
    event.preventDefault();
    if (readingQr || pending) return;
    const form = new FormData(event.currentTarget);
    run(() => savePaymentSettings({
      paymentInstructions: String(form.get("instructions") ?? ""),
      paymentMethods: methods,
    }), "Payment settings saved.");
  }}>
    <h2>Checkout payment</h2>
    <p className="muted">Members see these details when they choose Cash on Delivery / Pay to Admin.</p>
    <div className="field"><label htmlFor="payment-instructions">Payment instructions</label><textarea id="payment-instructions" name="instructions"
      defaultValue={settings.paymentInstructions} rows={4} required maxLength={1200} disabled={Boolean(pending)} /></div>
    <div className="row">
      <h2>Payment methods</h2>
      <button type="button" className="button secondary w-full sm:w-auto" disabled={Boolean(pending)}
        onClick={() => {
          const id = crypto.randomUUID();
          setMethods((current) => [...current, { id, type: "gcash", accountName: "", accountNumber: "" }]);
        }}>+ Add Payment Method</button>
    </div>
    {methods.length === 0 && <p className="muted">No payment methods added.</p>}
    {methods.length > 0 && <p id="payment-qr-hint" className="muted text-sm">QR images are optional. Choose a PNG, JPEG, WebP, or GIF up to 1 MB.</p>}
    {methods.map((method, index) => <fieldset key={method.id} className="panel stack" disabled={Boolean(pending)}>
      <legend className="px-2 font-bold">Payment method {index + 1}</legend>
      <div className="field-grid">
        <label>Type<select value={method.type}
          onChange={(event) => editMethod(method.id, { type: event.target.value as PaymentMethod["type"] })}>
          <option value="gcash">GCash</option><option value="bank">Bank</option>
        </select></label>
        {method.type === "bank" && <label>Bank Name (optional)<input value={method.bankName ?? ""} maxLength={100}
          onChange={(event) => editMethod(method.id, { bankName: event.target.value })} /></label>}
        <label>Account Name<input value={method.accountName} required maxLength={100}
          onChange={(event) => editMethod(method.id, { accountName: event.target.value })} /></label>
        <label>Account Number<input value={method.accountNumber} required maxLength={100}
          onChange={(event) => editMethod(method.id, { accountNumber: event.target.value })} /></label>
      </div>
      <label>QR Code Image<input type="file" accept={paymentQrTypes.join(",")} aria-describedby="payment-qr-hint"
        disabled={Boolean(readingQr)} onChange={(event) => readQr(method.id, event)} /></label>
      {readingQr === method.id && <p className="muted text-sm" role="status">Reading QR code…</p>}
      {method.qrCode && <div className="stack">
        <img className="w-32 max-w-full rounded border border-(--border)" src={method.qrCode}
          alt={`Payment QR code for method ${index + 1}`} referrerPolicy="no-referrer" />
        <div><button type="button" className="button secondary w-full sm:w-auto" disabled={readingQr === method.id}
          onClick={() => editMethod(method.id, { qrCode: undefined })}>Remove QR Code</button></div>
      </div>}
      <div><button type="button" className="button secondary w-full sm:w-auto" disabled={readingQr === method.id}
        onClick={() => setMethods((current) => current.filter(({ id }) => id !== method.id))}>Remove Payment Method</button></div>
    </fieldset>)}
    <div><button className="button w-full sm:w-auto" disabled={Boolean(readingQr || pending)}>
      {pending ? <PendingLabel>Saving...</PendingLabel> : "Save payment settings"}
    </button></div>
  </form>;
}
