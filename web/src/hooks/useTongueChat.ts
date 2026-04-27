"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { axiosErrorMessageForUser, isNotFoundError, isUserAbortError } from "@/lib/axiosUserErrors";
import { postChatTurn, postLoadHistory } from "@/lib/chatClient";
import { TONGUE_NEW_CHAT_SHELL_MS, TONGUE_NO_SESSION_BOOT_MS } from "@/lib/tongueChatConstants";
import {
  applyFrozenAssistantContent,
  readFrozenAssistantMapFromSessionStorage,
  readStoredSessionId,
  writeFrozenAssistantMapToSessionStorage,
} from "@/lib/tongueChatStorage";
import { TONGUE_SESSION_STORAGE_KEY } from "@/lib/tongueSession";
import type { ChatMessageDto } from "@/types/chat";

export function useTongueChat() {
  const [hydrated, setHydrated] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [date, setDate] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  /** After refresh with no saved session: short delay so h2 and composer do not flash under the header. */
  const [emptySessionBoot, setEmptySessionBoot] = useState(true);
  const [newChatShell, setNewChatShell] = useState(false);
  const [isSending, setIsSending] = useState(false);
  /** Sent text not yet replaced by the server response (optimistic user bubble). */
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  /** Last ASSISTANT message to render with client-side “streaming” (after send, not from history load). */
  const [streamingAssistantMessageId, setStreamingAssistantMessageId] = useState<string | null>(null);
  /** Bumped to stop client-side text streaming for the current message. */
  const [streamInterruptNonce, setStreamInterruptNonce] = useState(0);
  const abortSendRef = useRef<AbortController | null>(null);
  const newChatShellTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** If true, the in-flight turn was aborted by “New chat”: do not append a local user message. */
  const discardInFlightTurnOnAbortRef = useRef(false);
  const streamingAssistantIdRef = useRef<string | null>(null);
  /** Kept in sync with `sessionId` when the session changes (per turn, for freeze + storage). */
  const sessionIdRef = useRef<string | null>(null);
  /** Interrupted assistant replies: server keeps full text; we override in the UI while the id stays in the map. */
  const frozenAssistantContentByIdRef = useRef<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  /** Stale or missing conversation on the server: same cleanup as “Nuova chat” (storage + UI). */
  const resetAfterConversationNotFound = useCallback(() => {
    const prev = sessionIdRef.current;
    if (prev) {
      writeFrozenAssistantMapToSessionStorage(prev, new Map());
    }
    sessionIdRef.current = null;
    setSessionId(null);
    frozenAssistantContentByIdRef.current = new Map();
    setMessages([]);
    setStreamingAssistantMessageId(null);
    setStreamInterruptNonce(0);
    setDate("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TONGUE_SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    streamingAssistantIdRef.current = streamingAssistantMessageId;
  }, [streamingAssistantMessageId]);

  useLayoutEffect(() => {
    setHydrated(true);
    const sid = readStoredSessionId();
    if (sid) {
      setIsLoadingHistory(true);
      setEmptySessionBoot(false);
    } else {
      const t = setTimeout(() => {
        setEmptySessionBoot(false);
      }, TONGUE_NO_SESSION_BOOT_MS);
      return () => clearTimeout(t);
    }
  }, []);

  /** Restore session from localStorage: one loadHistory on mount (not on every message send). */
  useEffect(() => {
    if (!hydrated) return;

    const sid = readStoredSessionId();
    if (!sid) return;

    setSessionId(sid);
    sessionIdRef.current = sid;
    let cancelled = false;
    setIsLoadingHistory(true);
    setError(null);

    postLoadHistory(sid)
      .then((res) => {
        if (cancelled) return;
        frozenAssistantContentByIdRef.current = readFrozenAssistantMapFromSessionStorage(sid);
        setMessages(applyFrozenAssistantContent(res.messages, frozenAssistantContentByIdRef.current));
        setStreamingAssistantMessageId(null);
        setStreamInterruptNonce(0);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(axiosErrorMessageForUser(e));
        resetAfterConversationNotFound();
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, resetAfterConversationNotFound]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    if (sessionId) {
      window.localStorage.setItem(TONGUE_SESSION_STORAGE_KEY, sessionId);
    } else {
      window.localStorage.removeItem(TONGUE_SESSION_STORAGE_KEY);
    }
  }, [hydrated, sessionId]);

  useEffect(
    () => () => {
      if (newChatShellTimeoutRef.current != null) {
        clearTimeout(newChatShellTimeoutRef.current);
        newChatShellTimeoutRef.current = null;
      }
    },
    [],
  );

  const newChat = useCallback(() => {
    if (newChatShellTimeoutRef.current != null) {
      clearTimeout(newChatShellTimeoutRef.current);
      newChatShellTimeoutRef.current = null;
    }
    setNewChatShell(true);
    newChatShellTimeoutRef.current = setTimeout(() => {
      setNewChatShell(false);
      newChatShellTimeoutRef.current = null;
    }, TONGUE_NEW_CHAT_SHELL_MS);

    if (abortSendRef.current != null) {
      discardInFlightTurnOnAbortRef.current = true;
      abortSendRef.current.abort();
    }
    const prev = sessionIdRef.current;
    if (prev) {
      writeFrozenAssistantMapToSessionStorage(prev, new Map());
    }
    frozenAssistantContentByIdRef.current = new Map();
    sessionIdRef.current = null;
    setSessionId(null);
    setMessages([]);
    setPendingUserText(null);
    setStreamingAssistantMessageId(null);
    setStreamInterruptNonce(0);
    setIsSending(false);
    setError(null);
    setDate("");
  }, []);

  const endAssistantStream = useCallback(() => {
    const id = streamingAssistantIdRef.current;
    if (id) {
      const map = frozenAssistantContentByIdRef.current;
      map.delete(id);
      const sid = sessionIdRef.current;
      if (sid) {
        writeFrozenAssistantMapToSessionStorage(sid, map);
      }
    }
    setStreamingAssistantMessageId(null);
    setDate("");
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortSendRef.current) {
      abortSendRef.current.abort();
    }
    if (streamingAssistantIdRef.current) {
      setStreamInterruptNonce((n) => n + 1);
    }
  }, []);

  /** While streaming, persist the visible prefix (sessionStorage) so a refresh is not a “free skip” to the full server text. */
  const persistAssistantStreamProgress = useCallback((partial: string) => {
    const id = streamingAssistantIdRef.current;
    if (!id || partial.length === 0) return;
    const map = frozenAssistantContentByIdRef.current;
    map.set(id, partial);
    const sid = sessionIdRef.current;
    if (sid) {
      writeFrozenAssistantMapToSessionStorage(sid, map);
    }
  }, []);

  const freezeAssistantAtPartial = useCallback((partial: string) => {
    const id = streamingAssistantIdRef.current;
    if (!id) return;
    const map = frozenAssistantContentByIdRef.current;
    map.set(id, partial);
    const sid = sessionIdRef.current;
    if (sid) {
      writeFrozenAssistantMapToSessionStorage(sid, map);
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: partial, metadata: null } : m)),
    );
    setStreamingAssistantMessageId(null);
    streamingAssistantIdRef.current = null;
    setDate("");
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (trimmed === "") return;

      setPendingUserText(trimmed);
      setIsSending(true);
      setError(null);

      const ac = new AbortController();
      abortSendRef.current = ac;

      try {
        const res = await postChatTurn(
          {
            ...(date.trim() !== "" ? { date } : {}),
            message: trimmed,
            ...(sessionId ? { sessionId } : {}),
          },
          { signal: ac.signal },
        );
        setSessionId(res.sessionId);
        sessionIdRef.current = res.sessionId;
        setMessages(applyFrozenAssistantContent(res.messages, frozenAssistantContentByIdRef.current));
        const last = res.messages.at(-1);
        if (last?.role === "ASSISTANT") {
          setStreamInterruptNonce(0);
          setStreamingAssistantMessageId(last.id);
        } else {
          setStreamingAssistantMessageId(null);
        }
      } catch (e: unknown) {
        if (isUserAbortError(e)) {
          if (!discardInFlightTurnOnAbortRef.current) {
            setMessages((prev) => [
              ...prev,
              {
                id: `client-${crypto.randomUUID()}`,
                role: "USER",
                content: trimmed,
                createdAt: new Date().toISOString(),
                metadata: null,
              },
            ]);
          }
          setError(null);
        } else {
          setError(axiosErrorMessageForUser(e));
          if (isNotFoundError(e)) {
            resetAfterConversationNotFound();
          }
        }
      } finally {
        discardInFlightTurnOnAbortRef.current = false;
        setIsSending(false);
        setPendingUserText(null);
        abortSendRef.current = null;
      }
    },
    [date, sessionId, resetAfterConversationNotFound],
  );

  const headerOnlyShell = useMemo(
    () => !hydrated || isLoadingHistory || emptySessionBoot || newChatShell,
    [hydrated, isLoadingHistory, emptySessionBoot, newChatShell],
  );

  return {
    hydrated,
    headerOnlyShell,
    sessionId,
    messages,
    date,
    setDate,
    isLoadingHistory,
    isSending,
    pendingUserText,
    streamingAssistantMessageId,
    streamInterruptNonce,
    endAssistantStream,
    persistAssistantStreamProgress,
    freezeAssistantAtPartial,
    stopGeneration,
    error,
    setError,
    newChat,
    sendMessage,
  };
}
