import type { Request, Response } from "express";
import { Router } from "express";
import { MessageRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { prisma } from "../lib/prisma";
import {
  buildNewsAnalystSystemPrompt,
  completeChat,
  loadRecentMessagesForLlm,
  toOpenAiChatMessages,
} from "../lib/openaiChat";
import { stubChatReplyNoOpenAiKey, stubChatReplyOpenAiError } from "../lib/stubChatReply";
import { resolveArticlesForChatTurn } from "../news/resolveChatArticles";
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

    const threadAsc = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    const { articles, newsSource, windowFallback } = await resolveArticlesForChatTurn(threadAsc, {
      date,
      message: userText,
      sinceTime,
      timeZone,
      refreshNews,
    });

    const recentForLlm = await loadRecentMessagesForLlm(conversationId);
    const systemPrompt = buildNewsAnalystSystemPrompt(date, articles, sinceTime, timeZone);
    const openAiMessages = toOpenAiChatMessages(systemPrompt, recentForLlm);

    let reply: string;
    let stubReply = false;

    try {
      const outcome = await completeChat(openAiMessages);
      if (outcome.usedLlm) {
        reply = outcome.reply;
      } else {
        stubReply = true;
        reply = stubChatReplyNoOpenAiKey(date, userText);
      }
    } catch (e) {
      console.error("OpenAI error:", e);
      stubReply = true;
      reply = stubChatReplyOpenAiError(date, userText);
    }

    const assistantMetadata = {
      date,
      ...(sinceTime != null ? { sinceTime } : {}),
      ...(timeZone != null ? { timeZone } : {}),
      ...(refreshNews === true ? { refreshNews: true } : {}),
      articles,
      newsSource,
      ...(windowFallback ? { windowFallback: true } : {}),
      ...(stubReply ? { stubReply: true } : {}),
    };

    await prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: reply,
        metadata: assistantMetadata,
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
