import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import { chatTurnBodySchema, loadHistoryBodySchema, parseChatRequestBody } from "./chatSchemas";

test("loadHistory: valid minimal body", () => {
  const b = { action: "loadHistory" as const, sessionId: "3fa85f64-5717-4562-b3fc-2c963f66afa6" };
  assert.deepEqual(loadHistoryBodySchema.parse(b), b);
});

test("loadHistory: rejects extra keys (strict)", () => {
  assert.throws(
    () =>
      loadHistoryBodySchema.parse({
        action: "loadHistory",
        sessionId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        message: "x",
      }),
    (e) => e instanceof ZodError,
  );
});

test("parseChatRequestBody dispatches to loadHistory", () => {
  const p = parseChatRequestBody({
    action: "loadHistory",
    sessionId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  });
  assert.equal("action" in p && p.action, "loadHistory");
});

test("chat: requires message and accepts optional fields", () => {
  const p = chatTurnBodySchema.parse({
    message: "Ciao",
    action: "chat",
    date: "2025-01-20",
    sessionId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    refreshNews: true,
  });
  assert.equal(p.message, "Ciao");
  assert.equal(p.date, "2025-01-20");
  assert.equal(p.refreshNews, true);
});

test("chat: refreshNews optional, date optional", () => {
  const p = chatTurnBodySchema.parse({ message: "Solo testo" });
  assert.equal(p.message, "Solo testo");
  assert.equal(p.refreshNews, undefined);
  assert.equal(p.date, undefined);
});

test("chat: date must be YYYY-MM-DD when non-empty", () => {
  assert.throws(
    () => chatTurnBodySchema.parse({ message: "x", date: "20-01-2025" }),
    (e) => e instanceof ZodError,
  );
});

test("chat: sessionId must be uuid", () => {
  assert.throws(
    () => chatTurnBodySchema.parse({ message: "x", sessionId: "not-uuid" }),
    (e) => e instanceof ZodError,
  );
});

test("parseChatRequestBody: chat with refreshNews", () => {
  const p = parseChatRequestBody({ message: "q", date: "2025-01-20", refreshNews: false });
  assert.equal(p.message, "q");
  assert.equal(p.refreshNews, false);
});
