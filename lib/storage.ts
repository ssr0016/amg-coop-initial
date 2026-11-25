import { nextStatuses, orderTotal, productCategories, type Order, type OrderStatus, type Product, type Store, type User } from "./models";
import { seed } from "./seed";

const key = "ani-coop-market.v1";
const changed = "ani-store-change";
const waiting = "Your account is awaiting admin approval";
let cachedRaw: string | null = null;
let cachedStore = seed;

export function getStore(): Store {
  const raw = localStorage.getItem(key);
  if (raw !== cachedRaw) {
    cachedStore = raw ? JSON.parse(raw) as Store : seed;
    cachedRaw = raw;
  }
  return cachedStore;
}

function setStore(store: Store) {
  localStorage.setItem(key, JSON.stringify(store));
  window.dispatchEvent(new Event(changed));
}

export function seedStore() {
  if (localStorage.getItem(key) === null) {
    setStore(seed);
    return;
  }

  const store = getStore();
  if (store.catalogVersion === seed.catalogVersion) return;

  const legacyFoodCategories = ["Fresh produce", "Pantry", "Beverages", "Snacks"];
  const products = store.products.map((product) => {
    const category = productCategories.find((name) => name === product.category)
      ?? (legacyFoodCategories.includes(product.category) ? "Food Products" : "Essentials");
    const sample = seed.products.find((item) => item.id === product.id);
    const image = sample && product.image === `/images/${product.id}.webp` ? sample.image : product.image;
    return { ...product, category, image };
  });
  const existing = new Set(products.map((product) => product.id));
  const samples = seed.products.filter((product) => product.category !== "Food Products" && !existing.has(product.id));
  setStore({ ...store, catalogVersion: seed.catalogVersion, products: [...products, ...samples] });
}

export function subscribe(callback: () => void) {
  window.addEventListener(changed, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(changed, callback);
    window.removeEventListener("storage", callback);
  };
}

export function currentUser(store: Store) {
  return store.users.find((user) => user.id === store.session && user.status === "approved");
}

function requireRole(store: Store, role: User["role"]) {
  const user = currentUser(store);
  if (user?.role !== role) throw new Error("Sign in with an authorized account to continue.");
  return user;
}

export function login(email: string, password: string) {
  const store = getStore();
  const user = store.users.find((item) => item.email === email.trim().toLowerCase() && item.password === password);
  if (!user) throw new Error("Email or password is incorrect.");
  if (user.status === "pending") throw new Error(waiting);
  if (user.status === "rejected") throw new Error("Your application was declined. Contact the cooperative admin.");
  setStore({ ...store, session: user.id });
  return user.role;
}

export function logout() {
  setStore({ ...getStore(), session: null });
}

export function register(input: Pick<User, "name" | "email" | "password" | "memberId" | "contact">) {
  const store = getStore();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const memberId = input.memberId.trim().toUpperCase();
  const contact = input.contact.trim();
  if (!name || !memberId || !/^[+\d][\d\s()-]{6,19}$/.test(contact) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.password.length < 6) {
    throw new Error("Enter valid member details and a password of at least 6 characters.");
  }
  if (store.users.some((user) => user.email === email || user.memberId === memberId)) {
    throw new Error("That email or member ID is already registered.");
  }
  const user: User = { ...input, id: crypto.randomUUID(), name, email, memberId, contact, role: "member", status: "pending" };
  setStore({ ...store, users: [...store.users, user] });
  return waiting;
}

export function reviewMember(id: string, status: "approved" | "rejected") {
  const store = getStore();
  requireRole(store, "admin");
  setStore({ ...store, users: store.users.map((user) =>
    user.id === id && user.role === "member" && user.status === "pending" ? { ...user, status } : user) });
}

export function saveProduct(product: Product) {
  const store = getStore();
  requireRole(store, "admin");
  if (!productCategories.some((category) => category === product.category)) {
    throw new Error("Select a product category.");
  }
  if (![product.name, product.description, product.unit].every((value) => value.trim())
      || !Number.isSafeInteger(product.stock) || product.stock < 0
      || !Number.isSafeInteger(Math.round(product.price * 100)) || product.price <= 0) {
    throw new Error("Enter product details, a positive price, and a whole stock quantity.");
  }
  const existing = store.products.find((item) => item.id === product.id);
  if (product.id && !existing) throw new Error("This product has been removed.");
  const saved = { ...product, id: existing?.id ?? crypto.randomUUID(), price: Math.round(product.price * 100) / 100 };
  setStore({ ...store, products: existing
    ? store.products.map((item) => item.id === saved.id ? saved : item)
    : [...store.products, saved] });
}

export function deleteProduct(id: string) {
  const store = getStore();
  requireRole(store, "admin");
  setStore({ ...store, products: store.products.filter((product) => product.id !== id) });
}

export function setQuantity(productId: string, quantity: number | "add") {
  const store = getStore();
  const user = requireRole(store, "member");
  const cart = { ...store.carts[user.id] };
  const requested = quantity === "add" ? (cart[productId] ?? 0) + 1 : quantity;
  if (requested === 0) delete cart[productId];
  else {
    const product = store.products.find((item) => item.id === productId);
    if (!product || !Number.isSafeInteger(requested) || requested < 1 || requested > product.stock) {
      throw new Error("That quantity is unavailable. Check the current stock.");
    }
    cart[productId] = requested;
  }
  setStore({ ...store, carts: { ...store.carts, [user.id]: cart } });
}

export function checkout() {
  const store = getStore();
  const user = requireRole(store, "member");
  const items = Object.entries(store.carts[user.id] ?? {}).map(([productId, quantity]) => {
    const product = store.products.find((item) => item.id === productId);
    if (!product || quantity > product.stock) throw new Error("Stock changed. Return to your cart and update the affected items.");
    return { productId, name: product.name, price: product.price, quantity, category: product.category };
  });
  if (!items.length) throw new Error("Your cart is empty.");
  const order: Order = { id: crypto.randomUUID(), userId: user.id, items, total: orderTotal(items),
    createdAt: new Date().toISOString(), status: "pending_payment", paymentMethod: "cod", payment_reference: "", admin_notes: "" };
  const cart = store.carts[user.id];
  setStore({ ...store, orders: [order, ...store.orders], carts: { ...store.carts, [user.id]: {} },
    products: store.products.map((product) => ({ ...product, stock: product.stock - (cart[product.id] ?? 0) })) });
}

export function updateOrder(id: string, status: OrderStatus, payment_reference: string, admin_notes: string, expected: OrderStatus) {
  const store = getStore();
  requireRole(store, "admin");
  const order = store.orders.find((item) => item.id === id);
  if (!order || order.status !== expected || (status !== expected && !nextStatuses[expected].includes(status))) {
    throw new Error("Order status changed. Reopen the order and try again.");
  }
  saveOrderChange(store, order, { ...order, status, payment_reference, admin_notes });
}

export function cancelOrder(id: string) {
  const store = getStore();
  const user = requireRole(store, "member");
  const order = store.orders.find((item) => item.id === id && item.userId === user.id);
  if (!order || !nextStatuses[order.status].includes("cancelled")) {
    throw new Error("This order can no longer be cancelled.");
  }
  saveOrderChange(store, order, { ...order, status: "cancelled" });
}

function saveOrderChange(store: Store, order: Order, updated: Order) {
  const restore = updated.status === "cancelled" && order.status !== "cancelled";
  setStore({ ...store,
    orders: store.orders.map((item) => item.id === order.id ? updated : item),
    products: restore ? store.products.map((product) => ({
      ...product, stock: product.stock + (order.items.find((item) => item.productId === product.id)?.quantity ?? 0),
    })) : store.products });
}

export function saveInstructions(instructions: string) {
  const store = getStore();
  requireRole(store, "admin");
  if (!instructions.trim()) throw new Error("Enter payment instructions.");
  setStore({ ...store, settings: { paymentInstructions: instructions.trim() } });
}
