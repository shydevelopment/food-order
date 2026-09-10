# KGP QR payments

Implemented against the supplied **KGP-PGW [QR] API Specification v.1.2.1** (Create QR, Charge Inquiry, Notify Payment and Checksum). The tables use `status` and `source_type`; misspellings such as `stauts` in the example JSON are not treated as API fields.

KGP's Create QR parameter table calls `qr_expire_time` an integer, while the supplied UAT request example sends it as a quoted value. This implementation serializes the validated expiry as a string to match that example.

The Create QR examples also use a numeric, timestamp-shaped `reference_order`. The checkout uses a 20-digit Bangkok timestamp plus random suffix, which stays within the database/API reference limit and avoids UUID characters that the UAT gateway may reject.

## Setup

1. In Supabase SQL Editor, run `supabase/sql/payments_dashboard.sql` if it has not been installed, then run the entire `supabase/sql/kgp_qr_payments.sql`, followed by `supabase/sql/customer_order_cancellation.sql`. These scripts are transactional and can be rerun. They require the existing orders/order_items columns used by the cash checkout.
2. Set these **server-only** variables in `.env` and the deployment environment, then restart/redeploy Next.js:

   ```dotenv
   KGP_API_KEY=your-own-merchant-secret-key
   KGP_API_BASE_URL=https://openapi-uat.kgppayments.com
   KGP_QR_EXPIRE_SECONDS=600
   ```

   `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are also required. Never prefix the KGP key with `NEXT_PUBLIC_` and never use the sample key in the PDF. The expiry can be 60–86400 seconds. Production uses `https://openapi.kgppayments.com` and a matching production merchant key.
3. Register **`https://<your-site>/api/payments/kgp/webhook`** as the Notify Payment callback with KGP. For the current configured domain this is `https://foodorderkmutnb.shop/api/payments/kgp/webhook`. The PDF does not specify a callback field in Create QR, so no invented callback parameter is sent. This route must be reachable by KGP over HTTPS without interactive login.
4. Test in KGP UAT before switching to production. A real key and the SQL migration are required to generate an actual QR. No live payments or remote database migrations were performed during implementation.

## Behavior

- Choose QR at `/payment`. Checkout uses menu prices from Supabase and creates order, items and payment atomically. The browser sends a persistent checkout UUID so a lost response can be retried without duplicating the order. Each restaurant gets its own order and QR; restaurants that failed checkout stay in the cart.
- The server saves a unique reference before calling `POST /api/v2/qr`. Concurrent requests and refreshes reuse that record. PNG base64 from KGP is displayed; no secret appears in browser requests or image URLs.
- The payment page polls every 10 seconds while visible. The API throttles provider inquiries to once per eight seconds per payment. Customers can resume using the QR link on `/orders`.
- A payment becomes paid only after Charge Inquiry verifies THB, exact amount, merchant reference, QR ID and gateway order ID (when available), successful status, and Authorized/Settled state. Webhooks additionally verify the constant-time SHA-256 checksum with amount formatted to four decimal places. Inquiry is necessary because KGP's checksum does not cover reference/order/source fields.
- Database triggers prevent QR amount/method edits, manual browser confirmation, accepting unpaid QR orders, and cancelling an order with a live QR. Admin payment controls also defer QR status to KGP. Cash checkout remains available.
- Custom dishes without a menu price use cash. Funds go to the merchant account associated with `KGP_API_KEY`; there is no automatic split settlement to individual restaurants.

## Expiry and uncertain responses

If KGP returns HTTP 401/403, verify that `KGP_API_KEY` is the merchant **secret API key issued by KGP** and matches the UAT/production endpoint. A nonempty key is not necessarily a valid key. Restart the development server after editing `.env`. The server logs only the operation, HTTP status and numeric failure code, never credentials or raw response data.

An inquiry error is shown alongside the saved order/QR data so it cannot leave the page stuck loading. A Create QR request explicitly rejected with HTTP 401/403 is recorded as `failed` and can be retried after credentials are corrected. An inquiry authentication failure does **not** prove an earlier Create QR failed; older `creating` records are retained for investigation.

Customers can cancel unpaid cash/QR orders from `/orders` or the QR payment page and must provide a 3-200 character reason. The reason is saved in `orders.cancellation_reason` and is visible to both customer and restaurant. Paid, refunded, and completed orders cannot be cancelled this way. Cancellation verifies ownership and atomically updates the order and payment under database locks, including a final check for payment received during the request.

For an issued QR, the API queries KGP first and calls `POST /api/v2/qr/cancel/{qr_id}`. Only a matching successful cancellation or an explicit already-cancelled/expired response authorizes local cancellation. Provider outages/authentication errors leave the order unchanged. A QR that was never requested or whose creation was explicitly rejected can be cancelled immediately. A create with an unknown outcome and no returned QR must expire first. Its reference remains available for late payment reconciliation.

An expired QR is hidden. Expiry alone is not proof of nonpayment: inquiry and late callbacks can still confirm a payment. For an unpaid expired order, use the cancel button before placing another.

A timeout or malformed response after Create QR is **not** automatically retried with a fresh reference. The customer may explicitly retry, but the server resends the same unique `reference_order`; this prevents a second payable QR if KGP created the first request despite losing its response. The saved reference is also queried to recover a payment. KGP failure codes are shown without exposing credentials or raw provider responses.

Refunds and split settlement are outside this checkout flow. Customer cancellation never refunds or cancels a paid payment; handle refunds with KGP and reconcile the payment record through a trusted operational process. Notify Payment is not a Refund Notification endpoint.

## Verification

```sh
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

UAT checklist: QR creation and account name/amount; payment through a bank app; closing the page before payment; callback retries; invalid checksum; another user's order ID; mismatched amount/reference/source; refresh/concurrent tabs; provider timeout; expired QR and late payment; custom dishes; multiple restaurants with one rejected order; cash checkout. Confirm an unpaid QR order cannot be accepted and paid QR orders can be completed.
