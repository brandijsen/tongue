import type { Message } from "@prisma/client";
import { MessageRole } from "@prisma/client";
import OpenAI from "openai";
import { ARTICLE_EXCERPT_MAX_CHARS } from "../news/constants";
import type { NormalizedArticle } from "../news/types";
import { prisma } from "./prisma";

/** PF3: last 10 turns = 20 rows (USER + ASSISTANT). */
const MAX_LLM_MESSAGES = 20;

export function buildNewsAnalystSystemPrompt(
  date: string,
  articles: NormalizedArticle[],
  sinceTime?: string,
  timeZone?: string,
): string {
  const zoneLabel = timeZone ?? "UTC";
  const windowHint =
    sinceTime != null
      ? `Finestra richiesta: ${date} da ${sinceTime} (fuso ${zoneLabel}).`
      : `Finestra richiesta: giornata intera ${date} (fuso ${zoneLabel}).`;

  let articlesBlock: string;
  if (articles.length === 0) {
    articlesBlock =
      "Nessun articolo è disponibile nella finestra richiesta. Dichiaralo chiaramente e non inventare notizie.";
  } else {
    articlesBlock = articles
      .map((a, i) => {
        const excerpt =
          a.excerpt.length > ARTICLE_EXCERPT_MAX_CHARS
            ? `${a.excerpt.slice(0, ARTICLE_EXCERPT_MAX_CHARS)}…`
            : a.excerpt;
        const source = a.sourceName ?? a.providerId;
        return `${i + 1}. ${a.title}\n   Fonte: ${source}\n   URL: ${a.url}\n   Estratto: ${excerpt}`;
      })
      .join("\n\n");
  }

  return `Sei Tongue, un analista di notizie. Rispondi in italiano salvo richiesta esplicita dell'utente di usare un'altra lingua.
Tono giornalistico oggettivo: niente opinioni personali, niente supposizioni non supportate dagli articoli forniti.
Se i dati sono insufficienti, dillo chiaramente.
Struttura la risposta in 3–5 paragrafi quando il contesto lo consente.

${windowHint}

## Articoli (contesto per questo turno)
${articlesBlock}`;
}

export function toOpenAiChatMessages(
  systemContent: string,
  recentMessagesAsc: Message[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: systemContent }];
  for (const m of recentMessagesAsc) {
    if (m.role === MessageRole.USER) {
      out.push({ role: "user", content: m.content });
    } else {
      out.push({ role: "assistant", content: m.content });
    }
  }
  return out;
}

export async function loadRecentMessagesForLlm(conversationId: string): Promise<Message[]> {
  const recentDesc = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MAX_LLM_MESSAGES,
  });
  return recentDesc.slice().reverse();
}

export async function completeChat(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): Promise<{ reply: string; usedLlm: true } | { reply: null; usedLlm: false }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { reply: null, usedLlm: false };
  }

  const openai = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.4,
    max_tokens: 2000,
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned empty content");
  }
  return { reply: text, usedLlm: true };
}
