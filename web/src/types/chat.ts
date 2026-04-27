/** Aligned with `server/src/api/chatSerialize.ts` and ASSISTANT metadata. */

export type MessageRoleDto = "USER" | "ASSISTANT";

export type ArticleSourceDto = {
  title: string;
  url: string;
  abstract: string;
  source?: string;
  providerId: string;
};

export type AssistantMessageMetadata = {
  date: string;
  articles: ArticleSourceDto[];
  /** If false, hides the “Fonti” list (e.g. clarification-only); articles may stay in metadata for follow-ups. */
  showSources?: boolean;
  summaryPending?: boolean;
};

export type ChatMessageDto = {
  id: string;
  role: MessageRoleDto;
  content: string;
  createdAt: string;
  metadata: unknown | null;
};

export type ChatTurnResponse = {
  reply: string;
  sessionId: string;
  messages: ChatMessageDto[];
};

export type ChatLoadHistoryResponse = {
  sessionId: string;
  messages: ChatMessageDto[];
};

export type ChatTurnRequest = {
  action?: "chat";
  /** Omitted for follow-up on the last in-session news bundle (no new cascade). */
  date?: string;
  message: string;
  sessionId?: string;
  /** Optional: true forces a new fetch from providers for the same day; false reserved for future pool reuse. */
  refreshNews?: boolean;
};
