import { z } from "zod";
import { isValidIanaTimeZone } from "../lib/ianaTimeZone";

const dateYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
/** PS4 default max length for chat message */
const MESSAGE_MAX_LEN = 4000;
const timeHm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "sinceTime must be HH:mm (24h)");

export const loadHistoryBodySchema = z
  .object({
    action: z.literal("loadHistory"),
    sessionId: z.string().uuid(),
  })
  .strict();

export const chatTurnBodySchema = z
  .object({
    action: z.enum(["chat"]).optional(),
    date: dateYmd,
    message: z.string().min(1).max(MESSAGE_MAX_LEN),
    sessionId: z.string().uuid().optional(),
    sinceTime: timeHm.optional(),
    timeZone: z.string().min(1).optional(),
    refreshNews: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.sinceTime == null || data.timeZone != null, {
    message: "timeZone is required when sinceTime is set",
    path: ["timeZone"],
  })
  .refine((data) => data.timeZone == null || isValidIanaTimeZone(data.timeZone), {
    message: "timeZone must be a valid IANA time zone identifier (e.g. Europe/Rome)",
    path: ["timeZone"],
  });

export type LoadHistoryBody = z.infer<typeof loadHistoryBodySchema>;
export type ChatTurnBody = z.infer<typeof chatTurnBodySchema>;

export function parseChatRequestBody(body: unknown): LoadHistoryBody | ChatTurnBody {
  if (body != null && typeof body === "object" && "action" in body && body.action === "loadHistory") {
    return loadHistoryBodySchema.parse(body);
  }
  return chatTurnBodySchema.parse(body);
}
