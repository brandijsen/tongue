import type { Request, Response } from "express";
import { Router } from "express";
import { MessageRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { prisma } from "../lib/prisma";
import { fetchNormalizedArticles } from "../news/fetchNormalizedArticles";
import { parseChatRequestBody } from "./chatSchemas";
import { serializeMessage } from "./chatSerialize";

export const chatRouter = Router();

async function touchConversation(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

chatRouter.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = parseChatRequestBody(req.body);

    if ("action" in parsed && parsed.action === "loadHistory") {
      const conv = await prisma.conversation.findUnique({
        where: { id: parsed.sessionId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!conv) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }
      res.json({
        sessionId: conv.id,
        messages: conv.messages.map(serializeMessage),
      });
      return;
    }

    const {
      date,
      message: userText,
      sessionId: incomingSessionId,
      sinceTime,
      timeZone,
      refreshNews,
    } = parsed;

    let conversationId = incomingSessionId;

    if (conversationId) {
      const exists = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });
      if (!exists) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }
    } else {
      conversationId = randomUUID();
      await prisma.conversation.create({
        data: { id: conversationId },
      });
    }

    await prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: userText,
      },
    });
    await touchConversation(conversationId);

    const articles = await fetchNormalizedArticles({
      message: userText,
      date,
      sinceTime,
      timeZone,
    });

    // Stub reply (OpenAI in a later slice). Articles from PS2 mock/cascade for metadata / future prompt.
    const stubMeta = {
      stub: true,
      date,
      ...(sinceTime != null ? { sinceTime } : {}),
      ...(timeZone != null ? { timeZone } : {}),
      ...(refreshNews === true ? { refreshNews: true } : {}),
      articles,
    };

    const reply = `[stub] Ricevuto per il ${date}: ${userText.slice(0, 500)}${userText.length > 500 ? "…" : ""}`;

    await prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: reply,
        metadata: stubMeta,
      },
    });
    await touchConversation(conversationId);

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      reply,
      sessionId: conversationId,
      messages: messages.map(serializeMessage),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Invalid request body", details: err.flatten() });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
