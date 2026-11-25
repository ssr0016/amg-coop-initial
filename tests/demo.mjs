import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const categories = ["Food Products", "Household Products", "School Supplies", "Office Supplies", "Essentials", "Souvenirs"];
  const base = process.env.DEMO_URL ?? "http://localhost:3000";
  const go = (path) => page.goto(base + path);
  const filters = page.getByRole("group", { name: "Product categories" });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const link = (name) => page.getByRole("link", { name, exact: true });
  const field = (name) => page.getByLabel(name, { exact: true });
  const see = (value) => page.getByText(value, { exact: true }).filter({ visible: true }).first().waitFor();
  const seeMetric = (label, value) => page.locator(".metrics .panel").filter({ hasText: label })
    .getByText(value, { exact: true }).waitFor();
  const heading = (name) => page.getByRole("heading", { name, exact: true }).waitFor();
  const login = async (email, password) => {
    await heading("Sign in");
    await page.locator("form button:enabled").waitFor();
    await field("Email").fill(email);
    await field("Password").fill(password);
    await button("Sign in").press("Enter");
  };

  await go("/");
  const hero = page.getByRole("region", { name: "Featured categories" });
  const browse = hero.getByRole("link", { name: "Browse products" });
  const showSlide = (category) => hero.getByRole("button", { name: "Show " + category, exact: true });
  await hero.waitFor({ timeout: 3000 });
  assert.equal(await showSlide("Food Products").getAttribute("aria-current"), "true");
  const heroHeight = (await hero.boundingBox()).height;
  const buttonOffset = async () => (await browse.boundingBox()).y - (await hero.boundingBox()).y;
  const browseTop = await buttonOffset();
  await hero.getByRole("heading", { name: "Household Products" }).waitFor({ timeout: 7000 });
  await hero.getByRole("button", { name: "Pause slideshow" }).click();

  for (const category of categories) {
    await showSlide(category).press("Enter");
    await hero.getByRole("heading", { name: category, exact: true }).waitFor();
    assert.equal(await showSlide(category).getAttribute("aria-current"), "true");
    assert.equal((await hero.boundingBox()).height, heroHeight);
    assert.equal(await buttonOffset(), browseTop);
  }
  await browse.click();
  await page.waitForURL((url) => url.hash === "#catalog");

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
  const categorySelect = page.getByRole("combobox", { name: "Category", exact: true });
  await categorySelect.waitFor();
  assert.deepEqual(await categorySelect.locator("option").allTextContents(), categories);
  await categorySelect.selectOption("Food Products");
  for (const [name, value] of Object.entries({
    "Product name": "Demo Mango", "Price (PHP)": "75",
    Stock: "2", Unit: "1 kg", Description: "A product created during the demo.",
  })) await field(name).fill(value);
  const preview = page.getByRole("img", { name: "Product photo preview" });
  const chooseImage = async (file) => {
    const chooser = page.waitForEvent("filechooser", { timeout: 5000 });
    await Promise.all([chooser, button("Choose Image").press("Enter", { timeout: 5000 })]);
    await (await chooser).setFiles(file);
  };
  const fixtureImage = (name) => fileURLToPath(new URL(`../public/images/${name}.webp`, import.meta.url));
  assert.equal(await preview.count(), 0);
  await chooseImage(fixtureImage("banana"));
  await preview.waitFor();
  const originalPhoto = await preview.getAttribute("src");
  assert.match(originalPhoto, /^data:image\/webp;base64,/);
  await button("Save product").press("Enter");
  await see("Product saved.");
  const savedPhoto = () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("ani-coop-market.v1")).products.find((product) => product.name === "Demo Mango").image_url);
  assert.equal(await savedPhoto(), originalPhoto);

  const mango = page.getByRole("article").filter({ hasText: "Demo Mango" });
  await mango.getByRole("button", { name: "Edit", exact: true }).press("Enter");
  assert.equal(await preview.getAttribute("src"), originalPhoto);
  const sizeAlert = page.waitForEvent("dialog").then(async (dialog) => {
    const message = dialog.message();
    await dialog.accept();
    assert.equal(dialog.type(), "alert");
    assert.match(message, /too large.*2 MB/i);
  });
  await Promise.all([sizeAlert, chooseImage({
    name: "oversized.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  })]);
  assert.equal(await preview.getAttribute("src"), originalPhoto);
  await chooseImage(fixtureImage("honey"));
  await page.waitForFunction((previous) =>
    document.querySelector('img[alt="Product photo preview"]')?.getAttribute("src") !== previous, originalPhoto);
  const replacementPhoto = await preview.getAttribute("src");
  assert.match(replacementPhoto, /^data:image\/webp;base64,/);
  await field("Stock").fill("0");
  await button("Save product").press("Enter");
  await mango.getByText(/0 in stock/).waitFor();
  assert.equal(await savedPhoto(), replacementPhoto);
  await link("Shop").press("Enter");
  await page.waitForURL((url) => url.pathname === "/");
  await page.reload();
  await filters.getByRole("button", { name: "Food Products", exact: true }).press("Enter");
  await mango.getByText("Out of Stock", { exact: true }).waitFor();
  assert.equal(await mango.getByRole("button", { name: "Add Demo Mango to cart" }).isDisabled(), true);
  const verifyPhoto = async (photo) => {
    assert.equal(await photo.getAttribute("src"), replacementPhoto);
    await photo.evaluate((image) => image.decode());
  };
  await verifyPhoto(mango.locator("img"));
  await link("Demo Mango").press("Enter");
  await see("Out of Stock");
  await verifyPhoto(page.locator(".detail-grid img"));
  assert.equal(await button("Add to cart").isDisabled(), true);
  await link("Admin").press("Enter");
  await seeMetric("Low Stock Alerts", "1");
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
  await browse.waitFor();
  const cards = page.locator(".product-card");
  const quickCategories = page.getByRole("region", { name: "Shop by category" });
  assert.deepEqual(await quickCategories.getByRole("button").allTextContents(), categories);
  assert.deepEqual(await filters.getByRole("button").allTextContents(), ["All", ...categories]);
  assert.equal(await cards.count(), 8);
  assert.equal(await button("Prev").isDisabled(), true);
  await button("Next").press("Enter");
  await see("Page 2 of 2");
  assert.equal(await cards.count(), 4);
  assert.equal(await button("Next").isDisabled(), true);
  await button("Prev").press("Enter");
  await see("Page 1 of 2");
  assert.equal(await cards.count(), 8);
  await button("Next").press("Enter");
  await field("Search products").fill("pencil");
  await filters.getByRole("button", { name: "School Supplies", exact: true }).press("Enter");
  await see("1 product");
  assert.deepEqual(await cards.locator("h3").allTextContents(), ["Colored Pencil Set"]);
  await filters.getByRole("button", { name: "Office Supplies", exact: true }).press("Enter");
  await see("No products match your search.");
  await button("Clear filters").press("Enter");
  await see("Page 1 of 2");
  await field("Search products").fill("supplies");
  await see("No products match your search.");
  for (const category of categories) {
    await quickCategories.getByRole("button", { name: category, exact: true }).press("Enter");
    assert.equal(await filters.getByRole("button", { name: category, exact: true }).getAttribute("aria-pressed"), "true");
    await see("2 products");
    assert.deepEqual(await cards.locator(".product-category").allTextContents(), [category, category]);
    for (const src of await cards.locator("img").evaluateAll((images) => images.map((image) => image.src))) {
      assert.equal(new URL(src).hostname, "images.unsplash.com");
    }
    assert.equal(await cards.locator("img").count(), 2);
  }
  await button("All").press("Enter");
  await see("12 products");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
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
  await seeMetric("Total Revenue", "₱330.00");
  await seeMetric("Pending Orders", "0");
  await seeMetric("Total Approved Members", "2");
  await seeMetric("Low Stock Alerts", "0");
  await button("Sign out").press("Enter");
  await link("Sign in").press("Enter");
  await login("shopper@coop.test", "shopper123");
  await link("My orders").press("Enter");
  await see("Completed");
  await page.getByText("View order details", { exact: true }).press("Enter");
  await see("Sinandomeng Rice × 2");
  await see("Order total");
  await see("₱330.00");
  await see("Pay the cooperative cashier on delivery.");
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
  const legacy = await page.evaluate(() => {
    const key = "ani-coop-market.v1";
    const store = JSON.parse(localStorage.getItem(key));
    const rice = store.products.find((product) => product.id === "rice");
    const coffee = store.products.find((product) => product.id === "coffee");
    delete store.catalogVersion;
    store.products = [
      { ...rice, category: "Pantry", image: "/images/rice.webp" },
      { ...coffee, category: "Beverages", image: "/images/coffee.webp" },
    ];
    store.carts.member = { rice: 1 };
    localStorage.setItem(key, JSON.stringify(store));
    return { stock: rice.stock, carts: store.carts, orders: store.orders, session: store.session };
  });
  await page.reload();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("ani-coop-market.v1")).catalogVersion === 2);
  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem("ani-coop-market.v1")));
  assert.deepEqual({
    stock: migrated.products.find((product) => product.id === "rice").stock,
    carts: migrated.carts, orders: migrated.orders, session: migrated.session,
  }, legacy);
  assert.deepEqual(categories.map((category) => migrated.products.filter((product) => product.category === category).length),
    [2, 2, 2, 2, 2, 2]);

  assert.deepEqual(errors, []);
  console.log("Passed: account approvals, route protection, product CRUD and photo uploads, category filters and migration, stock limits, settings, cart persistence, COD checkout, admin order updates, revenue, isolated member history, and member order cancellation.");
} finally {
  await browser.close();
}
