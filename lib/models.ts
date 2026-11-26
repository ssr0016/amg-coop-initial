export type User = {
  id: string; name: string; email: string; password: string; memberId: string; contact: string;
  role: "admin" | "member"; status: "pending" | "approved" | "rejected";
};

export const productCategories = [
  "Food Products", "Household Products", "School Supplies", "Office Supplies", "Essentials", "Souvenirs",
] as const;

export type Product = {
  id: string; name: string; description: string; price: number; stock: number;
  category: string; image: string; image_url?: string; unit: string;
};

export const statuses = ["pending_payment", "confirmed", "paid", "completed", "return_requested", "cancelled"] as const;
export type OrderStatus = typeof statuses[number];
export const statusLabel: Record<OrderStatus, string> = {
  pending_payment: "Pending payment", confirmed: "Confirmed", paid: "Paid",
  completed: "Completed", return_requested: "Return Requested", cancelled: "Cancelled",
};
export const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: ["completed"],
  completed: [],
  return_requested: ["completed"],
  cancelled: [],
};

export const returnReasons = ["Damaged item", "Wrong item received", "Missing item"] as const;
export const preferredResolutionLabels = {
  replacement: "Replacement (Palitan)",
  refund: "Refund (Ibalik ang pera)",
};
export const returnDetailsMaxLength = 1000;
export const returnPhotoMaxBytes = 512 * 1024;
export const returnPhotoTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type OrderItem = { productId: string; name: string; price: number; quantity: number; category?: string };
export type Order = {
  id: string; userId: string; createdAt: string; items: OrderItem[]; total: number;
  paymentMethod: "cod"; status: OrderStatus; payment_reference: string; admin_notes: string;
  paymentAccount?: PaymentAccount;
  returnRequest?: {
    reason: typeof returnReasons[number]; details: string; photo?: string;
    preferredResolution?: keyof typeof preferredResolutionLabels;
    adminMessage?: string;
    previousStatus?: "paid" | "completed"; revision?: string;
  };
  returnResolution?: { note: string; photo?: string };
};
export const canSubmitPaymentReference = (order: Order) =>
  order.paymentMethod === "cod" && (order.status === "pending_payment" || order.status === "confirmed");
export const canRequestReturn = ({ status, returnRequest }: Order) =>
  !returnRequest && (status === "paid" || status === "completed");

export type PaymentAccount = {
  id: string;
  type: "gcash" | "bank";
  accountName: string;
  accountNumber: string;
  bankName?: string;
};
export type PaymentMethod = PaymentAccount & { qrCode?: string };
export type Settings = { paymentInstructions: string; paymentMethods: PaymentMethod[] };
export const paymentTypeLabel = ({ type, bankName }: PaymentAccount) =>
  type === "gcash" ? "GCash" : bankName ? `Bank (${bankName})` : "Bank";
export const paymentQrMaxBytes = 1024 * 1024;
export const paymentQrTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export type Cart = Record<string, number>;
export type Store = {
  catalogVersion?: 2;
  users: User[]; products: Product[]; orders: Order[]; carts: Record<string, Cart>;
  session: string | null; settings: Settings;
};
export const money = (value: number) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", currencyDisplay: "narrowSymbol",
}).format(value);
export const orderTotal = (items: OrderItem[]) =>
  items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;
