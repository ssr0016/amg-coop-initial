import {
  canRequestReturn, canSubmitPaymentReference, nextStatuses, orderTotal, paymentQrMaxBytes, paymentQrTypes, productCategories,
  returnDetailsMaxLength, returnPhotoMaxBytes, returnPhotoTypes, returnReasons,
  type Order, type PaymentMethod, type Product, type Settings, type Store, type User,
} from "./models";
import { seed } from "./seed";

const key = "ani-coop-market.v1";
const changed = "ani-store-change";
const waiting = "Your account is awaiting admin approval";
let cachedRaw: string | null = null;
let cachedStore = seed;

type LegacySettings = {
  paymentInstructions: string;
  gcashNumber?: string;
  gcashName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  paymentQrCode?: string;
};

function migratePaymentSettings(settings: Settings | LegacySettings): Settings {
  if ("paymentMethods" in settings) return settings;
  const paymentMethods: PaymentMethod[] = [];
  if (settings.gcashNumber || settings.gcashName) {
    paymentMethods.push({
      id: "legacy-gcash", type: "gcash", accountName: settings.gcashName ?? "", accountNumber: settings.gcashNumber ?? "",
    });
  }
  if (settings.bankName || settings.bankAccountNumber || settings.bankAccountName) {
    paymentMethods.push({
      id: "legacy-bank", type: "bank", accountName: settings.bankAccountName ?? "",
      accountNumber: settings.bankAccountNumber ?? "", bankName: settings.bankName,
    });
  }
  // A shared QR cannot be assigned safely when both legacy accounts exist.
  if (paymentMethods.length === 1) paymentMethods[0].qrCode = settings.paymentQrCode || undefined;
  return { paymentInstructions: settings.paymentInstructions, paymentMethods };
}

export function getStore(): Store {
  const raw = localStorage.getItem(key);
  if (raw !== cachedRaw) {
    const stored = raw ? JSON.parse(raw) as Omit<Store, "settings"> & { settings: Settings | LegacySettings } : seed;
    cachedStore = { ...stored, settings: migratePaymentSettings(stored.settings) };
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
  const member = store.users.find((user) => user.id === id && user.role === "member" && user.status === "pending");
  if (!member) throw new Error("This member application is no longer pending.");
  setStore({ ...store, users: store.users.map((user) =>
    user === member ? { ...user, status } : user) });
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
  return order.id;
}

export function submitPaymentReference(id: string, accountId: string, reference: string) {
  const store = getStore();
  const user = requireRole(store, "member");
  const order = store.orders.find((item) => item.id === id && item.userId === user.id);
  if (!order || !canSubmitPaymentReference(order)) throw new Error("This order can no longer accept a payment reference.");

  const value = reference.trim();
  if (!value || value.length > 100) throw new Error("Enter a payment reference of 1 to 100 characters.");
  const account = store.settings.paymentMethods.find((method) => method.id === accountId);
  if (!account?.accountName || !account.accountNumber) throw new Error("Choose an available payment account.");
  const { id: paymentId, type, accountName, accountNumber, bankName } = account;
  saveOrderChange(store, order, {
    ...order, payment_reference: value, paymentAccount: { id: paymentId, type, accountName, accountNumber, bankName },
  });
}

function memberReturnOrder(expected: Order) {
  const store = getStore();
  const user = requireRole(store, "member");
  const order = store.orders.find((item) => item.id === expected.id && item.userId === user.id);
  if (!order || order.status !== expected.status || order.returnRequest?.revision !== expected.returnRequest?.revision) {
    throw new Error("The order or return request changed. Reopen the order and try again.");
  }
  return { store, order };
}

export function requestReturn(expected: Order, reason: string, preferredResolution: string, details: string, photo?: string) {
  const { store, order } = memberReturnOrder(expected);
  if (order.status !== "return_requested" && !canRequestReturn(order)) {
    throw new Error("This order can no longer accept a return request.");
  }

  const selectedReason = returnReasons.find((option) => option === reason);
  if (!selectedReason) throw new Error("Select a reason for the return request.");
  if (preferredResolution !== "replacement" && preferredResolution !== "refund") {
    throw new Error("Select a preferred resolution.");
  }
  const trimmedDetails = details.trim();
  if (trimmedDetails.length > returnDetailsMaxLength) throw new Error("Enter up to 1,000 characters of details.");

  validateReturnPhoto(photo);

  saveOrderChange(store, order, {
    ...order, status: "return_requested", returnRequest: {
      reason: selectedReason, preferredResolution, details: trimmedDetails, photo, revision: crypto.randomUUID(),
      adminMessage: order.returnRequest?.adminMessage,
      previousStatus: order.status === "paid" ? "paid" : order.returnRequest?.previousStatus ?? "completed",
    },
  });
}

function validateReturnPhoto(photo?: string) {
  if (!photo) return;
  const [format, content, extra] = photo.split(",", 3);
  if (!returnPhotoTypes.some((type) => format === `data:${type};base64`) || !content ||
      content.length % 4 !== 0 || content.length > Math.ceil(returnPhotoMaxBytes / 3) * 4 ||
      extra !== undefined || !/^[A-Za-z0-9+/]+={0,2}$/.test(content) ||
      atob(content).length > returnPhotoMaxBytes) {
    throw new Error("Choose a JPEG, PNG, WebP, or GIF image up to 512 KB.");
  }
}

export function cancelReturnRequest(expected: Order) {
  const { store, order } = memberReturnOrder(expected);
  if (order.status !== "return_requested") throw new Error("This return request is no longer open.");
  // Older requests did not record the previous status.
  saveOrderChange(store, order, { ...order, status: order.returnRequest?.previousStatus ?? "completed", returnRequest: undefined });
}

export function requestItemReturn(expected: Order, message: string) {
  const store = getStore();
  requireRole(store, "admin");
  const order = store.orders.find((item) => item.id === expected.id);
  if (order?.status !== "return_requested" || !order.returnRequest ||
      order.returnRequest.revision !== expected.returnRequest?.revision ||
      order.returnRequest.adminMessage !== expected.returnRequest?.adminMessage) {
    throw new Error("The return request changed. Review it before replying.");
  }

  const adminMessage = message.trim();
  if (!adminMessage || adminMessage.length > returnDetailsMaxLength) {
    throw new Error("Enter a return message of 1 to 1,000 characters.");
  }
  saveOrderChange(store, order, { ...order, returnRequest: { ...order.returnRequest, adminMessage } });
}

type OrderUpdate = Pick<Order, "status" | "payment_reference" | "admin_notes">;

export function updateOrder(
  expected: Order, changes: Partial<OrderUpdate>, resolution?: Order["returnResolution"], receivedReturn = false,
) {
  const store = getStore();
  requireRole(store, "admin");
  const order = store.orders.find((item) => item.id === expected.id);
  if (!order || order.status !== expected.status) {
    throw new Error("Order status changed. Reopen the order and try again.");
  }

  const status = changes.status ?? order.status;
  const completingReplacement = order.status === "return_requested" && status === "completed";
  const refundingReturn = order.status === "return_requested" && status === "cancelled";
  if (completingReplacement || refundingReturn) {
    if (order.returnRequest?.revision !== expected.returnRequest?.revision) {
      throw new Error("The member changed the return request. Review it before resolving the issue.");
    }
    if (!receivedReturn) throw new Error("Confirm that you physically received the returned item.");
  }
  const markingPaid = status === "paid" && status !== order.status;
  const canMarkPaid = markingPaid && canSubmitPaymentReference(order) && Boolean(order.payment_reference);
  if (status !== order.status && !nextStatuses[order.status].includes(status) && !canMarkPaid && !refundingReturn) {
    throw new Error("Order status changed. Reopen the order and try again.");
  }

  const newReference = changes.payment_reference ?? expected.payment_reference;
  const editingReference = newReference !== expected.payment_reference;
  if ((markingPaid || editingReference) && (order.payment_reference !== expected.payment_reference ||
      JSON.stringify(order.paymentAccount) !== JSON.stringify(expected.paymentAccount))) {
    throw new Error("The payment reference or account changed. Review it and try again.");
  }
  const payment_reference = editingReference ? newReference : order.payment_reference;
  const updated = { ...order, ...changes, status, payment_reference };
  const note = resolution?.note.trim() ?? "";
  const photo = resolution?.photo;
  if (refundingReturn && (!note || !photo)) {
    throw new Error("Enter a refund note and upload proof of refund.");
  }
  if ((completingReplacement || refundingReturn) && resolution) {
    if (note.length > returnDetailsMaxLength) throw new Error("Enter up to 1,000 characters for the resolution note.");
    validateReturnPhoto(photo);
    if (refundingReturn) {
      updated.refund_note = note;
      updated.refund_proof = photo;
    } else {
      updated.returnResolution = { note, photo };
    }
  }
  saveOrderChange(store, order, updated);
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

export function completeOrder(id: string) {
  const store = getStore();
  const user = currentUser(store);
  if (!user) throw new Error("Sign in with an authorized account to continue.");

  const order = store.orders.find((item) => item.id === id && (user.role === "admin" || item.userId === user.id));
  if (!order || order.status !== "paid") {
    throw new Error("This order can no longer be completed.");
  }
  saveOrderChange(store, order, { ...order, status: "completed" });
}

function saveOrderChange(store: Store, order: Order, updated: Order) {
  const restore = updated.status === "cancelled" && order.status !== "cancelled";
  setStore({ ...store,
    orders: store.orders.map((item) => item.id === order.id ? updated : item),
    products: restore ? store.products.map((product) => ({
      ...product, stock: product.stock + (order.items.find((item) => item.productId === product.id)?.quantity ?? 0),
    })) : store.products });
}

export function savePaymentSettings(settings: Settings) {
  const store = getStore();
  requireRole(store, "admin");
  const paymentInstructions = settings.paymentInstructions.trim();
  if (!paymentInstructions || paymentInstructions.length > 1200) {
    throw new Error("Enter payment instructions of up to 1,200 characters.");
  }

  const ids = new Set<string>();
  const existing = new Map(store.settings.paymentMethods.map((method) => [method.id, method]));
  const paymentMethods = settings.paymentMethods.map(({ id, type, accountName, accountNumber, bankName, qrCode }) => {
    accountName = accountName.trim();
    accountNumber = accountNumber.trim();
    bankName = type === "bank" ? bankName?.trim() || undefined : undefined;
    if (!id || ids.has(id) || (type !== "gcash" && type !== "bank") ||
        !accountName || !accountNumber || [accountName, accountNumber, bankName ?? ""].some((value) => value.length > 100)) {
      throw new Error("Enter a valid type, account name, and account number for each payment method.");
    }
    ids.add(id);

    const uploadedQr = qrCode && qrCode.length <= Math.ceil(paymentQrMaxBytes / 3) * 4 + 32 &&
      paymentQrTypes.some((mime) => qrCode.startsWith(`data:${mime};base64,`));
    if (qrCode && !uploadedQr && qrCode !== existing.get(id)?.qrCode) {
      throw new Error("Upload a QR code image of up to 1 MB for each payment method.");
    }
    return { id, type, accountName, accountNumber, bankName, qrCode: qrCode || undefined };
  });

  try {
    setStore({ ...store, settings: { paymentInstructions, paymentMethods } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("Browser storage is full. Use smaller QR images or remove an unused image and try again.");
    }
    throw error;
  }
}
