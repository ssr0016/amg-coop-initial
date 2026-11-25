import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const base = process.env.DEMO_URL ?? "http://localhost:3000";
  const go = (path) => page.goto(base + path);
  const button = (name) => page.getByRole("button", { name, exact: true });
  const link = (name) => page.getByRole("link", { name, exact: true });
  const field = (name) => page.getByLabel(name, { exact: true });
  const see = (value) => page.getByText(value, { exact: true }).filter({ visible: true }).first().waitFor();
  const heading = (name) => page.getByRole("heading", { name, exact: true }).waitFor();
  const login = async (email, password) => {
    await heading("Sign in");
    await page.locator("form button:enabled").waitFor();
    await field("Email").fill(email);
    await field("Password").fill(password);
    await button("Sign in").press("Enter");
  };

  await go("/cart");
  await heading("Sign in");
  await login("pending@coop.test", "pending123");
  await see("Your account is awaiting admin approval");
  await link("Register").press("Enter");
  await heading("Register");
  await page.locator("form button:enabled").waitFor();
  for (const [name, value] of Object.entries({
    Name: "Demo Shopper", Email: "shopper@coop.test", Password: "shopper123",
    "Member ID": "ANI-900", "Contact number": "09171234567",
  })) await field(name).fill(value);
  await button("Create account").press("Enter");
  await see("Your account is awaiting admin approval");
  await page.getByRole("main").getByRole("link", { name: "Sign in", exact: true }).press("Enter");
  await login("shopper@coop.test", "shopper123");
  await see("Your account is awaiting admin approval");

  await login("admin@coop.test", "admin123");
  await heading("Dashboard");
  await link("Members").press("Enter");
  await page.getByRole("article").filter({ hasText: "Demo Shopper" }).getByRole("button", { name: "Approve", exact: true }).press("Enter");
  await see("Member approved.");
  await page.getByRole("article").filter({ hasText: "Paolo Reyes" }).getByRole("button", { name: "Reject", exact: true }).press("Enter");
  await see("No pending members.");
  await link("Products").press("Enter");
  await button("Add product").press("Enter");
  for (const [name, value] of Object.entries({
    "Product name": "Demo Mango", Category: "Fresh produce", "Price (PHP)": "75",
    Stock: "2", Unit: "1 kg", Description: "A product created during the demo.",
  })) await field(name).fill(value);
  await button("Save product").press("Enter");
  await see("Product saved.");
  const mango = page.getByRole("article").filter({ hasText: "Demo Mango" });
  await mango.getByRole("button", { name: "Edit", exact: true }).press("Enter");
  await field("Stock").fill("0");
  await button("Save product").press("Enter");
  await mango.getByText(/0 in stock/).waitFor();
  await link("Shop").press("Enter");
  await button("Fresh produce").press("Enter");
  await mango.getByText("Out of stock", { exact: true }).waitFor();
  await link("Admin").press("Enter");
  await link("Products").press("Enter");
  await mango.getByRole("button", { name: "Delete", exact: true }).press("Enter");
  await button("Confirm delete").press("Enter");
  await see("Product deleted.");
  await link("Settings").press("Enter");
  await field("Payment instructions").fill("Pay the cooperative cashier on delivery.");
  await button("Save instructions").press("Enter");
  await see("Payment instructions saved.");
  await button("Sign out").press("Enter");

  await link("Sign in").press("Enter");
  await login("shopper@coop.test", "shopper123");
  await page.getByRole("heading", { name: /Good food.\s*Grown together./ }).waitFor();
  await link("Virgin Coconut Oil").press("Enter");
  await see("Out of stock");
  assert.equal(await button("Add to cart").count(), 0);
  await link("Shop").press("Enter");
  await field("Search products").fill("rice");
  await link("Sinandomeng Rice").press("Enter");
  await heading("Sinandomeng Rice");
  await button("Add to cart").press("Enter");
  await see("Added to your cart.");
  await go("/cart");
  await field("Quantity for Sinandomeng Rice").fill("2");
  await page.reload();
  await field("Quantity for Sinandomeng Rice").waitFor();
  assert.equal(await field("Quantity for Sinandomeng Rice").inputValue(), "2");
  await link("Checkout").press("Enter");
  await see("Cash on Delivery / Pay to Admin");
  await see("Pay the cooperative cashier on delivery.");
  await button("Place order").press("Enter");
  await see("Order placed.");
  await see("Pending payment");
  await link("Cart (0)").press("Enter");
  await see("Your cart is empty.");
  await go("/admin/orders");
  await heading("Sign in");
  await login("admin@coop.test", "admin123");
  await heading("Dashboard");
  await link("Orders").press("Enter");
  await button("View order").press("Enter");
  await field("Order status").selectOption("confirmed");
  await button("Save order").press("Enter");
  await see("Order updated.");
  await field("Order status").selectOption("paid");
  await field("Payment reference").fill("COD-123");
  await field("Admin notes").fill("Cash received.");
  await button("Save order").press("Enter");
  await see("Paid");
  await field("Filter by status").selectOption("cancelled");
  await see("No orders match this status.");
  await field("Filter by status").selectOption("paid");
  await button("View order").press("Enter");
  assert.equal(await field("Admin notes").inputValue(), "Cash received.");
  await field("Order status").selectOption("completed");
  await button("Save order").press("Enter");
  await field("Filter by status").selectOption("completed");
  await see("Completed");
  await link("Overview").press("Enter");
  await see("₱330.00");
  await button("Sign out").press("Enter");
  await link("Sign in").press("Enter");
  await login("shopper@coop.test", "shopper123");
  await link("My orders").press("Enter");
  await see("Completed");
  await see("Payment reference: COD-123");
  await button("Sign out").press("Enter");
  await link("Sign in").press("Enter");
  await login("member@coop.test", "member123");
  await link("My orders").press("Enter");
  await see("You haven’t placed any orders yet.");
  const initialStock = await page.evaluate(() => {
    const key = "ani-coop-market.v1";
    const store = JSON.parse(localStorage.getItem(key));
    const [template] = store.orders;
    const statuses = ["pending_payment", "confirmed", "paid", "completed", "cancelled"];
    store.orders.push(...statuses.map((status, index) => ({
      ...template, id: `test000${index}`, userId: store.session, status,
    })));
    localStorage.setItem(key, JSON.stringify(store));
    return store.products.find((product) => product.id === "rice").stock;
  });
  await page.reload();
  await heading("My orders");
  const order = (index) => page.getByRole("article").filter({ hasText: `ANI-TEST000${index}` });
  const cancel = (index) => order(index).getByRole("button", { name: "Cancel Order", exact: true });
  await cancel(0).waitFor({ timeout: 5000 });
  await cancel(1).waitFor();
  assert.equal(await button("Cancel Order").count(), 2);

  const respondToCancellation = async (index, confirm) => {
    const answer = page.waitForEvent("dialog").then(async (dialog) => {
      const prompt = [dialog.type(), dialog.message()];
      await (confirm ? dialog.accept() : dialog.dismiss());
      assert.deepEqual(prompt, ["confirm", "Are you sure you want to cancel this order?"]);
    });
    await Promise.all([answer, cancel(index).press("Enter")]);
  };
  await respondToCancellation(0, false);
  await order(0).getByText("Pending payment", { exact: true }).waitFor();
  for (const index of [0, 1]) {
    await respondToCancellation(index, true);
    await order(index).getByText("Cancelled", { exact: true }).waitFor();
    assert.equal(await cancel(index).count(), 0);
  }
  await page.reload();
  await order(0).getByText("Cancelled", { exact: true }).waitFor();
  await order(1).getByText("Cancelled", { exact: true }).waitFor();
  assert.equal(await button("Cancel Order").count(), 0);
  assert.equal(await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ani-coop-market.v1")).products.find((product) => product.id === "rice").stock),
  initialStock + 4);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await go("/admin/orders");
  await login("admin@coop.test", "admin123");
  await heading("Dashboard");
  await link("Orders").press("Enter");
  await field("Filter by status").selectOption("cancelled");
  await order(0).getByText("Cancelled", { exact: true }).waitFor();
  await order(1).getByText("Cancelled", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log("Passed: approval and rejection, route protection, product CRUD and filters, stock limits, settings, cart persistence, COD checkout, order updates, revenue, isolated member history, and member order cancellation.");
} finally {
  await browser.close();
}
