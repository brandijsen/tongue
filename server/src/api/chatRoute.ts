import type { Request, Response } from "express";
import { Router } from "express";
import { MessageRole, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { NewsCascadeError, runNewsCascade } from "../news/cascade";
import { getNewsEnvConfig } from "../news/config";
import type { NormalizedArticle } from "../news/types";
import { buildNewsAssistantMessageMetadata } from "./assistantMessageMetadata";
import { summarizeNewsTurn } from "../openai/summarizeNews";
import { prisma } from "../lib/prisma";
import {
  findLatestNewsBundleWithContext,
  mergeSessionArticlePoolForSameDate,
} from "./chatBundle";
import { selectFollowUpArticleSubset } from "./followUpArticleFilter";
import { parseChatRequestBody } from "./chatSchemas";
import { serializeMessage } from "./chatSerialize";

export const chatRouter = Router();

/** In-thread reply when the user requests news without a calendar day and there is no prior article bundle. */
const ASSISTANT_PROMPT_SELECT_DATE =
  "Per consultare le notizie è necessario selezionare la data di riferimento nel campo sopra e formulare la richiesta in chat, quindi confermare con invio. " +
  "Senza una data indicata non è possibile avviare la ricerca sulle fonti.";

/** Empty pool from providers: user-facing; operator diagnostics stay in server logs. */
function noArticlesForUserQuery(): string {
  return (
    "Non risultano notizie per la data e le parole usate in questa ricerca. " +
    "Prova a correggere l'ortografia, a riformulare l'argomento o a selezionare un altro giorno."
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
  followUpContext?: { focusParagraphFromLastSummary: string } | null,
): Promise<{ text: string; summaryPending: boolean; showSources: boolean }> {
  if (articles.length === 0) {
    return { text: noArticlesForUserQuery(), summaryPending: false, showSources: false };
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { text: summarySkippedNoApiKey(articles.length), summaryPending: true, showSources: true };
  }
  const anchor = followUpContext?.focusParagraphFromLastSummary?.trim();
  try {
    const { text, clarifyOnly } = await summarizeNewsTurn({
      userMessage: userText,
      date,
      articles,
      ...(anchor ? { anchorFromLastSummary: anchor } : {}),
    });
    return { text, summaryPending: false, showSources: !clarifyOnly };
  } catch (e) {
    console.error("[chat] summarizeNewsTurn failed", e);
    return { text: summaryFailedFallback(articles.length), summaryPending: true, showSources: true };
  }
}

async function touchConversation(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

async function appendUserAndAssistantNudge(
  conversationId: string,
  userText: string,
  assistantText: string,
  assistantMetadata: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue,
): Promise<void> {
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
      metadata: assistantMetadata,
    },
  });
  await touchConversation(conversationId);
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

    const { date, message: userText, sessionId: incomingSessionId, refreshNews } = parsed;
    const hasDate = date !== undefined;

    if (!hasDate) {
      if (!incomingSessionId) {
        const conversationId = randomUUID();
        await prisma.conversation.create({ data: { id: conversationId } });
        await appendUserAndAssistantNudge(
          conversationId,
          userText,
          ASSISTANT_PROMPT_SELECT_DATE,
          Prisma.JsonNull,
        );
        const messages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: "asc" },
        });
        res.json({
          reply: ASSISTANT_PROMPT_SELECT_DATE,
          sessionId: conversationId,
          messages: messages.map(serializeMessage),
        });
        return;
      }
      const conv = await prisma.conversation.findUnique({
        where: { id: incomingSessionId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!conv) {
        res.status(404).json({ error: "Conversazione non trovata." });
        return;
      }
      const bundle = findLatestNewsBundleWithContext(conv.messages);
      if (!bundle) {
        await appendUserAndAssistantNudge(
          incomingSessionId,
          userText,
          ASSISTANT_PROMPT_SELECT_DATE,
          Prisma.JsonNull,
        );
        const messages = await prisma.message.findMany({
          where: { conversationId: incomingSessionId },
          orderBy: { createdAt: "asc" },
        });
        res.json({
          reply: ASSISTANT_PROMPT_SELECT_DATE,
          sessionId: incomingSessionId,
          messages: messages.map(serializeMessage),
        });
        return;
      }
      const { date: bundleDate, summaryAssistantContent } = bundle;
      const mergedArticles = mergeSessionArticlePoolForSameDate(
        conv.messages,
        bundleDate,
      );
      const selection = selectFollowUpArticleSubset(
        userText,
        mergedArticles,
        summaryAssistantContent,
      );
      const { text: assistantText, summaryPending, showSources } = await buildAssistantContent(
        userText,
        bundleDate,
        selection.articles,
        selection.focusParagraphFromLastSummary
          ? { focusParagraphFromLastSummary: selection.focusParagraphFromLastSummary }
          : null,
      );
      const metadata = buildNewsAssistantMessageMetadata({
        date: bundleDate,
        articles: selection.articles,
        summaryPending,
        showSources,
      });

      await prisma.message.create({
        data: {
          conversationId: incomingSessionId,
          role: MessageRole.USER,
          content: userText,
        },
      });
      await touchConversation(incomingSessionId);

      await prisma.message.create({
        data: {
          conversationId: incomingSessionId,
          role: MessageRole.ASSISTANT,
          content: assistantText,
          metadata,
        },
      });
      await touchConversation(incomingSessionId);

      const messages = await prisma.message.findMany({
        where: { conversationId: incomingSessionId },
        orderBy: { createdAt: "asc" },
      });

      res.json({
        reply: assistantText,
        sessionId: incomingSessionId,
        messages: messages.map(serializeMessage),
      });
      return;
    }

    /* --- New fetch: calendar day is set; run provider cascade. --- */
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
    let articles: NormalizedArticle[];
    try {
      articles = await runNewsCascade({ message: userText, date, refreshNews }, newsCfg);
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

    const { text: assistantText, summaryPending, showSources } = await buildAssistantContent(
      userText,
      date,
      articles,
    );
    const metadata = buildNewsAssistantMessageMetadata({
      date,
      articles,
      summaryPending,
      showSources,
    });

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
