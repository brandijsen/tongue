import { tongueFrozenAssistantStorageKey, TONGUE_SESSION_STORAGE_KEY } from "@/lib/tongueSession";
import type { ChatMessageDto } from "@/types/chat";

export function readStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(TONGUE_SESSION_STORAGE_KEY)?.trim();
  return v && v.length > 0 ? v : null;
}

export function applyFrozenAssistantContent(
  messages: ChatMessageDto[],
  frozen: ReadonlyMap<string, string>,
): ChatMessageDto[] {
  if (frozen.size === 0) return messages;
  return messages.map((m) => {
    if (m.role !== "ASSISTANT") return m;
    const c = frozen.get(m.id);
    if (c == null) return m;
    return { ...m, content: c, metadata: null };
  });
}

export function readFrozenAssistantMapFromSessionStorage(sessionId: string): Map<string, string> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.sessionStorage.getItem(tongueFrozenAssistantStorageKey(sessionId));
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as unknown;
    if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return new Map();
    return new Map(
      Object.entries(obj as Record<string, string>).filter(
        (e): e is [string, string] => typeof e[0] === "string" && typeof e[1] === "string",
      ),
    );
  } catch {
    return new Map();
  }
}

export function writeFrozenAssistantMapToSessionStorage(
  sessionId: string,
  frozen: ReadonlyMap<string, string>,
): void {
  if (typeof window === "undefined") return;
  const key = tongueFrozenAssistantStorageKey(sessionId);
  if (frozen.size === 0) {
    window.sessionStorage.removeItem(key);
    return;
  }
  try {
    window.sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(frozen)));
  } catch {
    /* ignore quota / private mode */
  }
}
