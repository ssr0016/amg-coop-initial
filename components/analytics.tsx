import { productCategories, statusLabel, type Store } from "../lib/models";
import { Empty } from "./shared";

const number = new Intl.NumberFormat("en-PH");
const percent = new Intl.NumberFormat("en-PH", { style: "percent", maximumFractionDigits: 1 });
const orderGroups = ["pending", "paid", "completed", "cancelled"] as const;

export function Analytics({ orders, salesOrders, products }: Pick<Store, "orders" | "products"> & { salesOrders: Store["orders"] }) {
  const catalog = new Map(products.map(({ id, category }) => [id, category]));
  const categorySales = new Map<string, number>(productCategories.map((category) => [category, 0]));
  const productSales = new Map<string, { name: string; quantity: number }>();
  const counts = { pending: 0, paid: 0, completed: 0, cancelled: 0 };
  let uncategorized = 0;

  for (const { status } of orders) {
    const group = status === "pending_payment" || status === "confirmed" ? "pending" : status;
    counts[group]++;
  }

  for (const { items } of salesOrders) {
    for (const { productId, name, quantity, category } of items) {
      const sold = productSales.get(productId);
      if (sold) sold.quantity += quantity;
      else productSales.set(productId, { name, quantity });

      const itemCategory = category ?? catalog.get(productId) ?? "";
      const categoryQuantity = categorySales.get(itemCategory);
      if (categoryQuantity === undefined) uncategorized += quantity;
      else categorySales.set(itemCategory, categoryQuantity + quantity);
    }
  }

  const topProducts = [...productSales].sort(([, a], [, b]) => b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, 3);
  const largestCategory = Math.max(1, ...categorySales.values());
  const breakdown = orderGroups
    .filter((group) => group !== "cancelled" || counts.cancelled > 0)
    .map((group) => ({
      group,
      label: group === "pending" ? "Pending" : statusLabel[group],
      share: counts[group] / (orders.length || 1),
    }));

  return <section className="analytics" aria-labelledby="analytics-heading">
    <h2 id="analytics-heading">Analytics</h2>
    {topProducts.length ? <div className="analytics-grid">
      <section className="panel" aria-labelledby="category-sales-heading">
        <h3 id="category-sales-heading">Sales by Category</h3>
        <p className="muted text-sm">Units sold · Paid and completed orders</p>
        <ul className="category-sales" role="list">
          {[...categorySales].map(([category, quantity]) => <li key={category}>
            <span>{category}</span>
            <span className="category-sales-track" aria-hidden="true">
              <span style={{ width: `${quantity / largestCategory * 100}%` }} />
            </span>
            <strong>{number.format(quantity)}</strong>
          </li>)}
        </ul>
        {uncategorized > 0 && <p className="muted text-sm mt-3">{number.format(uncategorized)} sold without a recorded category</p>}
      </section>
      <section className="panel" aria-labelledby="top-products-heading">
        <h3 id="top-products-heading">Top Selling Products</h3>
        <ol className="top-products" role="list">
          {topProducts.map(([id, { name, quantity }], index) => <li key={id}>
            <span className="top-product-rank" aria-hidden="true">{index + 1}</span>
            <span>{name}</span>
            <strong>{number.format(quantity)} sold</strong>
          </li>)}
        </ol>
      </section>
    </div> : <Empty>No paid or completed sales in this period.</Empty>}
    {orders.length > 0 && <section className="panel" aria-labelledby="order-breakdown-heading">
      <h3 id="order-breakdown-heading">Order Status Breakdown</h3>
      <div className="order-breakdown-bar" aria-hidden="true">
        {breakdown.map(({ group, share }) =>
          <span key={group} data-group={group} style={{ width: `${share * 100}%` }} />)}
      </div>
      <ul className="order-breakdown-legend" role="list">
        {breakdown.map(({ group, label, share }) => <li key={group}>
          <span className="order-breakdown-dot" data-group={group} aria-hidden="true" />
          <span>{label}</span>
          <strong>{percent.format(share)}</strong>
        </li>)}
      </ul>
    </section>}
  </section>;
}
