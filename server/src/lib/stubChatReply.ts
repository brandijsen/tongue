const USER_SNIP_LEN = 500;

function userSnippet(userText: string): string {
  return `${userText.slice(0, USER_SNIP_LEN)}${userText.length > USER_SNIP_LEN ? "…" : ""}`;
}

export function stubChatReplyNoOpenAiKey(date: string, userText: string): string {
  return `[stub] OPENAI_API_KEY mancante. Ricevuto per il ${date}: ${userSnippet(userText)}`;
}

export function stubChatReplyOpenAiError(date: string, userText: string): string {
  return `[stub] Errore LLM. Ricevuto per il ${date}: ${userSnippet(userText)}`;
}
