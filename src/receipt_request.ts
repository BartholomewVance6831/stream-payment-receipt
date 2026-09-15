import { z } from "zod";

export const receiptRequestSchema = z.object({
  paymentId: z.string().min(1).max(120),
  status: z.enum(["settled", "pending", "refunded"]),
  paidAt: z.string().datetime(),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  creatorName: z.string().min(1).max(120),
  assetTitle: z.string().min(1).max(200),
  buyerEmail: z.string().email()
}).strict();

export type ReceiptRequest = z.infer<typeof receiptRequestSchema>;

export class ReceiptDecisionError extends Error {
  readonly reason: "payment_not_settled";

  constructor(reason: "payment_not_settled") {
    super("A receipt can only be issued for a settled payment");
    this.name = "ReceiptDecisionError";
    this.reason = reason;
  }
}
