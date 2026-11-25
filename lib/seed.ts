import type { Product, Store } from "./models";

const products: Product[] = [
  { id: "rice", name: "Sinandomeng Rice", description: "Soft, fragrant white rice milled for everyday Filipino meals.", price: 165, stock: 28, category: "Pantry", unit: "2 kg", image: "/images/rice.webp" },
  { id: "honey", name: "Wildflower Honey", description: "Golden honey with a light floral finish, ready for tea or toast.", price: 245, stock: 16, category: "Pantry", unit: "250 g", image: "/images/honey.webp" },
  { id: "coffee", name: "Benguet Arabica Coffee", description: "Whole Philippine arabica beans with a balanced, nutty roast.", price: 320, stock: 14, category: "Beverages", unit: "250 g", image: "/images/coffee.webp" },
  { id: "pechay", name: "Fresh Pechay", description: "Tender greens for soups, stir-fries, and quick weekday meals.", price: 45, stock: 22, category: "Fresh produce", unit: "250 g", image: "/images/pechay.webp" },
  { id: "tomatoes", name: "Native Tomatoes", description: "Bright, juicy tomatoes for ensalada, ginisa, or sawsawan.", price: 70, stock: 19, category: "Fresh produce", unit: "500 g", image: "/images/tomatoes.webp" },
  { id: "sugar", name: "Muscovado Sugar", description: "Unrefined cane sugar with a rich molasses flavor.", price: 105, stock: 12, category: "Pantry", unit: "500 g", image: "/images/sugar.webp" },
  { id: "banana", name: "Saba Banana Chips", description: "Crisp slices of saba banana with a touch of sweetness.", price: 95, stock: 18, category: "Snacks", unit: "150 g", image: "/images/banana.webp" },
  { id: "coconut", name: "Virgin Coconut Oil", description: "Cold-pressed coconut oil with a mild, fresh aroma.", price: 280, stock: 0, category: "Pantry", unit: "250 ml", image: "/images/coconut.webp" },
];

export const seed: Store = {
  products,
  users: [
    { id: "admin", name: "Co-op Admin", email: "admin@coop.test", password: "admin123", memberId: "", contact: "", role: "admin", status: "approved" },
    { id: "member", name: "Mara Santos", email: "member@coop.test", password: "member123", memberId: "ANI-101", contact: "09170000001", role: "member", status: "approved" },
    { id: "pending", name: "Paolo Reyes", email: "pending@coop.test", password: "pending123", memberId: "ANI-102", contact: "09170000002", role: "member", status: "pending" },
  ],
  orders: [], carts: {}, session: null,
  settings: { paymentInstructions: "Pay the amount shown when your order arrives or directly to the cooperative admin. The admin will update your order after receiving payment." },
};
