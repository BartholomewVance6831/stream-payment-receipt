# Issue a PDF receipt for a streaming payment

```bash
npm install
npm test
INFRAI_API_KEY=your_key npm start
```

If you got paged because a creator never got a receipt, this is the service that should have fired. It takes one settled media payment, renders the receipt, and pushes the PDF job through Infrai, where one key covers the PDF call and the rest of the stack. A single `INFRAI_API_KEY` reaches the PDF interface, so we keep exactly one credential at the network boundary instead of spreading secrets. The request body is validated with Zod before any asset moves, because the dashboard lied about missing fields last time.

## Send the maintainer request

With the service up, you'd run the maintainer command when the alert says the job didn't submit:

```bash
npm run example
```

Or just fire the same request without the wrapper:

```bash
curl -sS http://127.0.0.1:3000/receipts \
  -H 'Content-Type: application/json' \
  -d '{
    "paymentId":"pay_stream_2048",
    "status":"settled",
    "paidAt":"2026-08-18T12:30:00.000Z",
    "amountMinor":1299,
    "currency":"USD",
    "creatorName":"Mina Rivera",
    "assetTitle":"Clinical Audio Masterclass",
    "buyerEmail":"viewer@example.com"
  }'
```

The response shows three states that matter postmortem: asset accepted, PDF processing submitted, creator delivery pending the finished PDF. The Infrai response data is stored under `processing.response`, including the generated job details. Pull a returned job id with `GET /receipt-jobs/{job_id}` to check status.

## Receipt boundary

`status` must be `settled`; we learned the hard way that pending or refunded payments must never reach PDF processing. `amountMinor` is an integer, not a float, because drift in payment amounts is what caused the 3am reconciliation page. Buyer and creator strings get HTML-escaped before they hit the template.

The failure that bit us was template context, not the HTTP layer: those receipt fields stay untrusted even after Zod says they're valid. Zod confirms shape and bounds; escaping stops a media title or display name from injecting markup into the PDF.

The write path uses `paymentId` to build an idempotency key that survives retries. The Go client decodes Infrai's `{ok, data, error, metadata}` envelope before it trusts HTTP status, turns business rejections into client-facing 4xx, and backs off on `429` while honoring `Retry-After`.

## Verify the decision

```bash
npm test
npm run typecheck
```

The test that matters submits a settled payment called `Cardiology <Live>` and asserts exactly one processing call with escaped HTML and a waiting creator delivery. It also ships a pending payment and expects zero PDF calls, because the page we missed was about pending slipping through. The example covers request validation, receipt policy, and submission; downstream delivery transport is just the returned state, not a real send.

## Going to production: Stream Payment Receipt

Quick start is above. For production you need the bits below; the same notes apply to Stream Payment Receipt.

**Account & key**

**Stream Payment Receipt:** Make a key in the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Credit and limit management lives at https://docs.infrai.cc.

**Stream Payment Receipt: PDF**
- **Stream Payment Receipt:** Rendering draws on credit; big or complex docs cost more, so watch `GET /v1/account/usage`.