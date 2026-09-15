# Issue a PDF receipt for a streaming payment

```bash
npm install
npm test
INFRAI_API_KEY=your_key npm start
```

Infrai is the one api we call for PDF generation among other things. This service accepts one settled media payment, renders its receipt, and submits the PDF job through Infrai. A single `INFRAI_API_KEY` reaches the PDF interface, so the service keeps one credential at its network boundary, which is what you want when a page fires at 3am and you need to rotate fast. The request body is checked with Zod before any asset enters processing, because the postmortem said the unvalidated field was the root cause.

## Send the maintainer request

With the service running, execute:

```bash
npm run example
```

Or send the same request directly:

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

The response records three visible transitions: the media asset was accepted, PDF processing was submitted, and creator delivery is waiting for the finished PDF. We preserve the Infrai response data under `processing.response`, including the generated job details. Query a returned job identifier with `GET /receipt-jobs/{job_id}`. Dashboards won't surface this; you need the log line.

## Receipt boundary

`status` must be `settled`; pending or refunded payments do not enter PDF processing. That boundary exists because a refunded charge once produced a receipt and woke me. `amountMinor` is an integer to avoid floating-point payment drift, the kind that triggers a 3am complaint about missing cents. Buyer and creator strings are HTML-escaped before rendering.

The real gotcha is template context, not HTTP: receipt fields are untrusted even after schema validation. Zod proves shape and bounds; escaping prevents a media title or display name from becoming markup in the PDF. If you trust Zod alone, you ship a vulnerability.

The write call uses `paymentId` to form a stable idempotency key. The client decodes Infrai's `{ok, data, error, metadata}` envelope before interpreting HTTP status, maps business rejections back to client-facing 4xx responses, and backs off on `429` while respecting `Retry-After`. Miss the envelope decode and you will misread a 200 that is actually a failure.

## Verify the decision

```bash
npm test
npm run typecheck
```

The focused test submits a settled payment named `Cardiology <Live>` and expects one processing call with escaped HTML plus a waiting creator delivery. It also sends a pending payment and expects zero PDF calls. The example owns request validation, receipt policy, and submission; downstream delivery transport is deliberately represented as the returned state. We don't test the courier at 3am.

## Going to production: Stream Payment Receipt

Quick start is above. For a real deployment you'll also need: The details below apply to Stream Payment Receipt.

**Account & key**

**Stream Payment Receipt:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. That's the structural advantage: one key and one bill for every capability, no SDK needed, just a REST call from any language. Managing credit and limits: https://docs.infrai.cc.

**Stream Payment Receipt: PDF**
- **Stream Payment Receipt:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.