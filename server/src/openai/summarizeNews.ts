import type { NormalizedArticle } from "../news/types";
import { getOpenAIChatModel, getOpenAIClient } from "./client";

const EXCERPT_CAP = 1_200;

const SYSTEM_PROMPT = [
  'Agisci come un news analyst per un prodotto chiamato Tongue.',
  "",
  "Obiettivo: Tongue ha l'obiettivo di permettere agli utenti di capire rapidamente cosa è successo nel mondo, senza leggere decine di articoli. Rispondi in italiano.",
  "",
  "Stile:",
  "- Usa un tono formale da giornalista esperto.",
  "- Evita opinioni personali o giudizi.",
  "- Non inventare informazioni non presenti negli articoli forniti.",
  "- Se le informazioni non sono sufficienti per rispondere alla richiesta dell'utente, dichiaralo esplicitamente.",
  "",
  "Risultato atteso:",
  "- Riassumi i fatti principali in modo comprensibile anche a un non esperto.",
  "- Evidenzia trend, eventi chiave e collegamenti tra le notizie solo se supportati dagli articoli.",
  "- Sii breve ma informativo (massimo 3–5 paragrafi).",
  "",
  "Usa esclusivamente il testo degli articoli sotto \"Articoli (fonti)\". Non citare URL; se serve, indica la testata tra parentesi.",
].join("\n");

function buildArticlesBlock(articles: NormalizedArticle[]): string {
  const lines: string[] = [];
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const ex = a.excerpt.replace(/\s+/g, " ").trim().slice(0, EXCERPT_CAP);
    const src = a.sourceName?.trim() || a.providerId;
    lines.push(
      `### ${i + 1}. ${a.title}\n` +
        `Testata: ${src}\n` +
        `Testo (estratto):\n${ex}`,
    );
  }
  return lines.join("\n\n");
}

export type SummarizeNewsParams = {
  userMessage: string;
  date: string;
  articles: NormalizedArticle[];
};

/**
 * Final user-facing summary (consegna: system prompt + articles + user message).
 */
export async function summarizeNewsTurn(params: SummarizeNewsParams): Promise<string> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (params.articles.length === 0) {
    throw new Error("summarizeNewsTurn requires at least one article");
  }

  const user = [
    `Data di riferimento (UTC, YYYY-MM-DD): ${params.date}`,
    "",
    "Richiesta dell'utente:",
    params.userMessage,
    "",
    "Articoli (fonti):",
    buildArticlesBlock(params.articles),
  ].join("\n");

  const completion = await client.chat.completions.create({
    model: getOpenAIChatModel(),
    temperature: 0.35,
    max_tokens: 1_600,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty summary response");
  }
  return text;
}
