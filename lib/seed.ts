import type { Product, Store } from "./models";

const products: Product[] = [
  { id: "rice", name: "Sinandomeng Rice", description: "Soft, fragrant white rice for everyday Filipino meals.", price: 165, stock: 28, category: "Food Products", unit: "2 kg", image: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=1000&q=85" },
  { id: "coffee", name: "Benguet Arabica Coffee", description: "Medium-roast whole beans with a smooth, nutty finish.", price: 320, stock: 14, category: "Food Products", unit: "250 g", image: "https://images.unsplash.com/photo-1632099824857-3e2e0aa5015f?auto=format&fit=crop&w=1000&q=85" },
  { id: "dishwashing-liquid", name: "Lemon Dishwashing Liquid", description: "Lemon-scented dish soap for everyday plates and cookware.", price: 89, stock: 36, category: "Household Products", unit: "500 mL", image: "https://images.unsplash.com/photo-1653248773863-d7a474f90ec8?auto=format&fit=crop&w=1000&q=85" },
  { id: "cotton-towel", name: "Cotton Bath Towel", description: "Soft, absorbent white cotton towel with a stitched hem.", price: 249, stock: 18, category: "Household Products", unit: "1 towel", image: "https://images.unsplash.com/photo-1760722974657-f64bce2f9cc5?auto=format&fit=crop&w=1000&q=85" },
  { id: "ruled-notebook", name: "Ruled School Notebook", description: "Lined pages for class notes, assignments, and practice.", price: 48, stock: 60, category: "School Supplies", unit: "80 sheets", image: "https://images.unsplash.com/photo-1761322572550-967ea8c0bfd9?auto=format&fit=crop&w=1000&q=85" },
  { id: "colored-pencils", name: "Colored Pencil Set", description: "Twelve colored pencils for school projects and drawing.", price: 125, stock: 32, category: "School Supplies", unit: "12 pencils", image: "https://images.unsplash.com/photo-1646318591979-1f5f1ffec11c?auto=format&fit=crop&w=1000&q=85" },
  { id: "desk-stapler", name: "Compact Desk Stapler", description: "A desktop stapler for reports, receipts, and documents.", price: 139, stock: 22, category: "Office Supplies", unit: "1 stapler", image: "https://images.unsplash.com/photo-1654931800100-2ecf6eee7c64?auto=format&fit=crop&w=1000&q=85" },
  { id: "desk-calculator", name: "Desktop Calculator", description: "A large-key calculator for budgets, invoices, and totals.", price: 299, stock: 15, category: "Office Supplies", unit: "1 calculator", image: "https://images.unsplash.com/photo-1762427354397-854a52e0ded7?auto=format&fit=crop&w=1000&q=85" },
  { id: "bath-soap", name: "Handcrafted Bath Soap", description: "A hand-cut bath bar for everyday washing.", price: 75, stock: 40, category: "Essentials", unit: "100 g", image: "https://images.unsplash.com/photo-1612799897310-293b5811d300?auto=format&fit=crop&w=1000&q=85" },
  { id: "water-bottle", name: "Stainless Steel Water Bottle", description: "A reusable bottle with a screw-top lid for school, work, or travel.", price: 349, stock: 20, category: "Essentials", unit: "500 mL", image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1000&q=85" },
  { id: "canvas-tote", name: "Colorblock Canvas Tote", description: "A reusable canvas tote with colorful handles and a wide opening.", price: 220, stock: 24, category: "Souvenirs", unit: "1 tote", image: "https://images.unsplash.com/photo-1780480999314-b82a1f2f9de6?auto=format&fit=crop&w=1000&q=85" },
  { id: "floral-mug", name: "Floral Ceramic Mug", description: "A ceramic mug with a colorful floral design for coffee or tea.", price: 195, stock: 16, category: "Souvenirs", unit: "1 mug", image: "https://images.unsplash.com/photo-1578195683194-c87f800e41b7?auto=format&fit=crop&w=1000&q=85" },
];

export const seed: Store = {
  products,
  catalogVersion: 2,
  users: [
    { id: "admin", name: "Co-op Admin", email: "admin@coop.test", password: "admin123", memberId: "", contact: "", role: "admin", status: "approved" },
    { id: "member", name: "Mara Santos", email: "member@coop.test", password: "member123", memberId: "AMG-101", contact: "09170000001", role: "member", status: "approved" },
    { id: "pending", name: "Paolo Reyes", email: "pending@coop.test", password: "pending123", memberId: "AMG-102", contact: "09170000002", role: "member", status: "pending" },
  ],
  orders: [], carts: {}, session: null,
  settings: { paymentInstructions: "Pay the amount shown when your order arrives or directly to the cooperative admin. The admin will update your order after receiving payment." },
};
