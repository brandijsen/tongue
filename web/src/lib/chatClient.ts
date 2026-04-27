/**
 * Client API chat: solo `POST /api/chat` (per `loadHistory` usa `action` nel body JSON, non GET).
 */
import { api } from "./api";
import type {
  ChatLoadHistoryResponse,
  ChatTurnRequest,
  ChatTurnResponse,
} from "@/types/chat";

export async function postChatTurn(
  body: ChatTurnRequest,
  options?: { signal?: AbortSignal },
): Promise<ChatTurnResponse> {
  const { data } = await api.post<ChatTurnResponse>("/api/chat", body, {
    signal: options?.signal,
  });
  return data;
}

export async function postLoadHistory(sessionId: string): Promise<ChatLoadHistoryResponse> {
  const { data } = await api.post<ChatLoadHistoryResponse>("/api/chat", {
    action: "loadHistory",
    sessionId,
  });
  return data;
}
