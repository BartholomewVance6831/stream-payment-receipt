import assert from "node:assert/strict";
import test from "node:test";
import { issueReceipt } from "../src/receipt_sender.ts";

const payment = {
  paymentId: "pay_2048",
  status: "settled" as const,
  paidAt: "2026-08-18T12:30:00.000Z",
  amountMinor: 1299,
  currency: "USD",
  creatorName: "Mina & Co",
  assetTitle: "Cardiology <Live>",
  buyerEmail: "viewer@example.com"
};

test("a settled media payment is submitted once with escaped receipt data", async () => {
  let sentHtml = "";
  let sentKey = "";
  const result = await issueReceipt(payment, {
    async generateReceipt(html, key) {
      sentHtml = html;
      sentKey = key;
      return { ok: true, data: { job_id: "job_17" } };
    }
  });

  assert.equal(sentKey, "receipt-pay_2048");
  assert.match(sentHtml, /Cardiology &lt;Live&gt;/);
  assert.doesNotMatch(sentHtml, /Cardiology <Live>/);
  assert.equal(result.processing.state, "submitted");
  assert.equal(result.creatorDelivery.state, "awaiting_pdf");
});

test("a pending payment never enters PDF processing", async () => {
  let calls = 0;
  await assert.rejects(
    issueReceipt({ ...payment, status: "pending" }, {
      async generateReceipt() {
        calls += 1;
        return { ok: true };
      }
    }),
    /settled payment/
  );
  assert.equal(calls, 0);
});
