export type User = {
  id: string; name: string; email: string; password: string; memberId: string; contact: string;
  role: "admin" | "member"; status: "pending" | "approved" | "rejected";
};

export type Product = {
  id: string; name: string; description: string; price: number; stock: number;
  category: string; image: string; unit: string;
};

export const statuses = ["pending_payment", "confirmed", "paid", "completed", "cancelled"] as const;
export type OrderStatus = typeof statuses[number];
export const statusLabel: Record<OrderStatus, string> = {
  pending_payment: "Pending payment", confirmed: "Confirmed", paid: "Paid",
  completed: "Completed", cancelled: "Cancelled",
};
export const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: ["completed"],
  completed: [],
  cancelled: [],
};

export type OrderItem = { productId: string; name: string; price: number; quantity: number };
export type Order = {
  id: string; userId: string; createdAt: string; items: OrderItem[]; total: number;
  paymentMethod: "cod"; status: OrderStatus; payment_reference: string; admin_notes: string;
};
export type Settings = { paymentInstructions: string };
export type Cart = Record<string, number>;
export type Store = {
  users: User[]; products: Product[]; orders: Order[]; carts: Record<string, Cart>;
  session: string | null; settings: Settings;
};
export const money = (value: number) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", currencyDisplay: "narrowSymbol",
}).format(value);
export const orderTotal = (items: OrderItem[]) =>
  items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;
