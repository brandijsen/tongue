import { z } from "zod";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const MESSAGE_MAX_LEN = 4000;

export const loadHistoryBodySchema = z
  .object({
    action: z.literal("loadHistory"),
    sessionId: z.string().uuid(),
  })
  .strict();

const optionalDateYmd = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "string" && v.trim() === "") return undefined;
    return v;
  },
  dateYmd.optional(),
);

export const chatTurnBodySchema = z
  .object({
    action: z.enum(["chat"]).optional(),
    /** When set, the news cascade runs for this calendar day. Omit for follow-up on the last bundle. */
    date: optionalDateYmd,
    message: z.string().min(1).max(MESSAGE_MAX_LEN),
    sessionId: z.string().uuid().optional(),
    /**
     * If `true`, ask the backend for a new provider pull for the same calendar day; if omitted, first
     * turns behave like today; `false` is accepted for a future “reuse pool” path (not fully wired yet).
     */
    refreshNews: z.boolean().optional(),
  })
  .strict();

export type LoadHistoryBody = z.infer<typeof loadHistoryBodySchema>;
export type ChatTurnBody = z.infer<typeof chatTurnBodySchema>;

export function parseChatRequestBody(body: unknown): LoadHistoryBody | ChatTurnBody {
  if (body != null && typeof body === "object" && "action" in body && body.action === "loadHistory") {
    return loadHistoryBodySchema.parse(body);
  }
  return chatTurnBodySchema.parse(body);
}
