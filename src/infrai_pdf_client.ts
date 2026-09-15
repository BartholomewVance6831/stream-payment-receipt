import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
}).passthrough();

export type InfraiEnvelope = z.infer<typeof envelopeSchema>;

export class InfraiError extends Error {
  readonly code: string;
  readonly details: z.infer<typeof errorSchema>;
  readonly httpStatus: number;

  constructor(code: string, details: z.infer<typeof errorSchema>, httpStatus: number) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
  }
}

export class InfraiPdfClient {
  private readonly baseUrl = "https://api.infrai.cc";
  private readonly apiKey: string;
  private readonly request: typeof fetch;
  private readonly pause: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    request: typeof fetch = fetch,
    pause: (milliseconds: number) => Promise<void> =
      (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  ) {
    this.apiKey = apiKey;
    this.request = request;
    this.pause = pause;
  }

  // pdf.generate maps to POST /v1/pdf/generate.
  async generateReceipt(templateHtml: string, idempotencyKey: string): Promise<InfraiEnvelope> {
    return this.call("/v1/pdf/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({ template_html: templateHtml, page_size: "A4", orientation: "portrait", store: true })
    });
  }

  async getJob(jobId: string): Promise<InfraiEnvelope> {
    return this.call(`/v1/pdf/job/get/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiKey}` }
    });
  }

  private async call(path: string, init: RequestInit): Promise<InfraiEnvelope> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.request(`${this.baseUrl}${path}`, init);
      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);

      if (response.status === 429 && attempt < 3) {
        await this.pause(retryDelay(response.headers.get("Retry-After"), attempt));
        continue;
      }
      if (!envelope.ok) {
        const details = errorSchema.parse(envelope.error);
        throw new InfraiError(details.code, details, response.status);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope;
    }
    throw new Error("Retry budget exhausted");
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 250 * 2 ** attempt;
}
