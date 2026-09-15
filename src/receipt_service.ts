import { createServer } from "node:http";
import { InfraiError, InfraiPdfClient } from "./infrai_pdf_client.ts";
import { receiptRequestSchema, ReceiptDecisionError } from "./receipt_request.ts";
import { issueReceipt } from "./receipt_sender.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const client = new InfraiPdfClient(apiKey);

createServer(async (request, response) => {
  const jobMatch = request.url?.match(/^\/receipt-jobs\/([^/]+)$/);
  if (request.method === "GET" && jobMatch) {
    try {
      const result = await client.getJob(decodeURIComponent(jobMatch[1]));
      return send(response, 200, result.data);
    } catch (error) {
      return sendInfraiError(response, error);
    }
  }
  if (request.method !== "POST" || request.url !== "/receipts") {
    return send(response, 404, { error: "route_not_found" });
  }

  try {
    const input = receiptRequestSchema.parse(await readJson(request));
    const result = await issueReceipt(input, client);
    return send(response, 202, result);
  } catch (error) {
    if (error instanceof ReceiptDecisionError) return send(response, 409, { error: error.reason });
    if (error instanceof InfraiError) return sendInfraiError(response, error);
    if (error instanceof SyntaxError || (error && typeof error === "object" && "issues" in error)) {
      return send(response, 400, { error: "invalid_request" });
    }
    return send(response, 502, { error: "receipt_processing_failed" });
  }
}).listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () => {
  console.log(`Receipt service listening on http://127.0.0.1:${process.env.PORT ?? 3000}`);
});

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw new SyntaxError("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function sendInfraiError(response: import("node:http").ServerResponse, error: unknown): void {
  if (error instanceof InfraiError) {
    const status = error.httpStatus >= 400 && error.httpStatus < 500 ? error.httpStatus : 502;
    return send(response, status, { error: error.code, message: error.message });
  }
  return send(response, 502, { error: "job_lookup_failed" });
}
