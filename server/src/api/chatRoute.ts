import type { Request, Response } from "express";
import { Router } from "express";
import { MessageRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { NewsCascadeError, runNewsCascade } from "../news/cascade";
import { getNewsEnvConfig } from "../news/config";
import { articlesToMetadataRows } from "../news/articleMetadata";
import type { NormalizedArticle } from "../news/types";
import { summarizeNewsTurn } from "../openai/summarizeNews";
import { prisma } from "../lib/prisma";
import { parseChatRequestBody } from "./chatSchemas";
import { serializeMessage } from "./chatSerialize";

export const chatRouter = Router();

function noArticlesReply(): string {
  return (
    "Non risultano articoli per la data e la ricerca correnti. " +
    "Controlla la data, le chiavi dei provider in .env oppure imposta USE_MOCK_NEWS=true per provare con dati locali."
  );
}

function summarySkippedNoApiKey(articleCount: number): string {
  return (
    `Trovati ${articleCount} articol${articleCount === 1 ? "o" : "i"} per questo turno. ` +
    "Imposta OPENAI_API_KEY nel backend per generare la sintesi; in metadata trovi titolo, URL e testata delle fonti."
  );
}

function summaryFailedFallback(articleCount: number): string {
  return (
    `Trovati ${articleCount} articol${articleCount === 1 ? "o" : "i"}, ma la sintesi automatica non è riuscita. ` +
    "Riprova più tardi; in metadata restano le fonti selezionate."
  );
}

async function buildAssistantContent(
  userText: string,
  date: string,
  articles: NormalizedArticle[],
): Promise<{ text: string; summaryPending: boolean }> {
  if (articles.length === 0) {
    return { text: noArticlesReply(), summaryPending: false };
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { text: summarySkippedNoApiKey(articles.length), summaryPending: true };
  }
  try {
    const text = await summarizeNewsTurn({
      userMessage: userText,
      date,
      articles,
    });
    return { text, summaryPending: false };
  } catch (e) {
    console.error("[chat] summarizeNewsTurn failed", e);
    return { text: summaryFailedFallback(articles.length), summaryPending: true };
  }
}

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
        res.status(404).json({ error: "Conversazione non trovata." });
        return;
      }
      res.json({
        sessionId: conv.id,
        messages: conv.messages.map(serializeMessage),
      });
      return;
    }

    const { date, message: userText, sessionId: incomingSessionId } = parsed;

    let conversationId = incomingSessionId;
    let createdConversation = false;

    if (conversationId) {
      const exists = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });
      if (!exists) {
        res.status(404).json({ error: "Conversazione non trovata." });
        return;
      }
    } else {
      conversationId = randomUUID();
      await prisma.conversation.create({
        data: { id: conversationId },
      });
      createdConversation = true;
    }

    const newsCfg = getNewsEnvConfig();
    let articles;
    try {
      articles = await runNewsCascade({ message: userText, date }, newsCfg);
    } catch (e) {
      if (e instanceof NewsCascadeError) {
        if (createdConversation) {
          await prisma.conversation.delete({ where: { id: conversationId } }).catch(() => undefined);
        }
        res.status(503).json({
          error:
            "Impossibile recuperare le notizie: nessun provider configurato. Imposta almeno una chiave API o USE_MOCK_NEWS=true.",
        });
        return;
      }
      throw e;
    }

    const { text: assistantText, summaryPending } = await buildAssistantContent(userText, date, articles);
    const metadata = {
      date,
      articles: articlesToMetadataRows(articles),
      summaryPending,
    };

    await prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: userText,
      },
    });
    await touchConversation(conversationId);

    await prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: assistantText,
        metadata,
      },
    });
    await touchConversation(conversationId);

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      reply: assistantText,
      sessionId: conversationId,
      messages: messages.map(serializeMessage),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Richiesta non valida.", details: err.flatten() });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Errore interno del server." });
  }
});
