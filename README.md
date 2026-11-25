# AMG Co-op Market

A browser-only e-commerce demo for a Philippine cooperative. Prices are in Philippine pesos and checkout uses Cash on Delivery / Pay to Admin.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. To check the production build, run `npm run build` and then `npm start`.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@coop.test | admin123 |
| Approved member | member@coop.test | member123 |
| Pending member | pending@coop.test | pending123 |

Use the **same browser profile and URL** when switching accounts. Register a member and try signing in before approval. Sign in as admin, open **Members**, and approve that application. Sign back in as the new member, add an item to your cart, and place a COD order. Sign back in as admin, open **Orders**, and save **Confirmed**, then **Paid**. The member can see the updated status in **My orders**.

Everything lives in localStorage for the current browser and origin. Clear the site's browser data to reset the demo. Use fictional member details and passwords.

## Deploy and verify

Run `vercel deploy` from the project root, or import the project using the Next.js preset. No environment variables, database, or payment credentials are required.

With the app running on port 3000, run `npx playwright install chromium` once and then `npm run test:e2e`. The test uses an isolated browser context and leaves your demo data alone. Optionally set `DEMO_URL` to test a different URL.

## Replace demo storage

`lib/models.ts` defines the records, `lib/seed.ts` supplies the fixtures, and `lib/storage.ts` owns persistence and the actions used by the UI. Keep the action inputs and display models when replacing the storage module with an asynchronous API client. Replace the browser snapshot subscription with fetched data and refresh it after writes. Production authentication and authorization, password hashing, and inventory/order transactions belong on the server. Demo credentials, session IDs, and personal details in localStorage are unsuitable for production.
