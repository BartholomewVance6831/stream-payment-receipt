import type { InfraiEnvelope } from "./infrai_pdf_client.ts";
import { InfraiPdfClient } from "./infrai_pdf_client.ts";
import { ReceiptDecisionError, type ReceiptRequest } from "./receipt_request.ts";

export type ReceiptDelivery = {
  paymentId: string;
  asset: { title: string; ingestion: "accepted" };
  processing: { state: "submitted"; response: InfraiEnvelope["data"] };
  creatorDelivery: { creatorName: string; state: "awaiting_pdf" };
};

export async function issueReceipt(
  input: ReceiptRequest,
  client: Pick<InfraiPdfClient, "generateReceipt">
): Promise<ReceiptDelivery> {
  if (input.status !== "settled") throw new ReceiptDecisionError("payment_not_settled");

  const response = await client.generateReceipt(renderReceipt(input), `receipt-${input.paymentId}`);
  return {
    paymentId: input.paymentId,
    asset: { title: input.assetTitle, ingestion: "accepted" },
    processing: { state: "submitted", response: response.data },
    creatorDelivery: { creatorName: input.creatorName, state: "awaiting_pdf" }
  };
}

function renderReceipt(input: ReceiptRequest): string {
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: input.currency
  }).format(input.amountMinor / 100);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Payment receipt</title></head>
<body><main><h1>Payment receipt</h1><dl>
<dt>Payment</dt><dd>${escapeHtml(input.paymentId)}</dd>
<dt>Paid</dt><dd>${escapeHtml(input.paidAt)}</dd>
<dt>Media</dt><dd>${escapeHtml(input.assetTitle)}</dd>
<dt>Creator</dt><dd>${escapeHtml(input.creatorName)}</dd>
<dt>Buyer</dt><dd>${escapeHtml(input.buyerEmail)}</dd>
<dt>Total</dt><dd>${escapeHtml(amount)}</dd>
</dl></main></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character] ?? character);
}
