"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChatMessageDto } from "@/types/chat";
import { AssistantLoadingBubble } from "./AssistantLoadingBubble";
import { ChatColumn } from "./ChatColumn";
import { MessageBubble } from "./MessageBubble";

type Props = {
  messages: ChatMessageDto[];
  /** Just-sent message, shown optimistically until the server response arrives. */
  pendingUserText?: string | null;
  /** Show a loading row under the pending user message. */
  awaitingAssistant?: boolean;
  /** Assistant message to stream in the last turn. */
  streamingAssistantMessageId?: string | null;
  streamInterruptNonce?: number;
  onAssistantStreamComplete?: () => void;
  onAssistantStreamInterrupted?: (partial: string) => void;
  onAssistantStreamProgress?: (partial: string) => void;
};

const PENDING_USER_ID = "__pending_user__";

/**
 * MessageList (ChatGPT-style layout / scroll).
 *
 * Behaviour:
 * - Scrolling is the document (`body`); there is no inner scroll container.
 * - Header and composer are sticky to the viewport, so the scrollbar spans the full page.
 * - On send, the user message is scrolled just below the header; the assistant
 *   reply is rendered below and never “pushes” the user message upward.
 * - A dynamic spacer after the last message leaves enough room to keep the
 *   user message anchored at the top; as the reply grows, the spacer shrinks so
 *   there is no large blank gap under the answer.
 * - We do not auto-follow on every stream tick: the user bubble stays put and
 *   text grows downward.
 */
export function MessageList({
  messages,
  pendingUserText,
  awaitingAssistant,
  streamingAssistantMessageId,
  streamInterruptNonce = 0,
  onAssistantStreamComplete,
  onAssistantStreamInterrupted,
  onAssistantStreamProgress,
}: Props) {
  const lastUserRef = useRef<HTMLDivElement>(null);
  const lastAssistantRef = useRef<HTMLDivElement>(null);
  const [spacerH, setSpacerH] = useState(0);
  const snappedKeyRef = useRef<string | null>(null);

  const latestUserId = useMemo(() => {
    if (pendingUserText) return PENDING_USER_ID;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "USER") return messages[i].id;
    }
    return null;
  }, [messages, pendingUserText]);

  const latestAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "ASSISTANT") return messages[i].id;
    }
    return null;
  }, [messages]);

  // Dynamic spacer: tall enough to scroll the last user message to the top while
  // leaving room for the incoming reply. As the reply grows, the spacer goes to 0.
  useLayoutEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return;
      const headerEl = document.querySelector<HTMLElement>("[data-site-header]");
      const composerEl =
        document.querySelector<HTMLElement>("[data-chat-composer]");
      const headerH = headerEl?.offsetHeight ?? 0;
      const composerH = composerEl?.offsetHeight ?? 0;
      const viewportH = window.innerHeight;
      const anchorH =
        lastAssistantRef.current?.offsetHeight ??
        lastUserRef.current?.offsetHeight ??
        0;
      const need = viewportH - headerH - composerH - anchorH;
      setSpacerH(Math.max(0, need));
    };

    update();

    const observers: ResizeObserver[] = [];
    const obsTargets = [
      lastAssistantRef.current,
      lastUserRef.current,
      document.querySelector("[data-site-header]"),
      document.querySelector("[data-chat-composer]"),
    ].filter(Boolean) as HTMLElement[];
    if (typeof ResizeObserver !== "undefined") {
      for (const t of obsTargets) {
        const obs = new ResizeObserver(update);
        obs.observe(t);
        observers.push(obs);
      }
    }
    window.addEventListener("resize", update);
    return () => {
      for (const o of observers) o.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [messages, pendingUserText, streamingAssistantMessageId, latestAssistantId, latestUserId]);

  // On new user message (send), align it just under the header.
  // This is the only auto-scroll: not during streaming and not on other updates.
  useLayoutEffect(() => {
    if (!latestUserId) {
      snappedKeyRef.current = null;
      return;
    }
    if (snappedKeyRef.current === latestUserId) return;
    snappedKeyRef.current = latestUserId;

    const el = lastUserRef.current;
    if (!el) return;

    // Wait one frame so layout (including the spacer) has settled.
    const raf = requestAnimationFrame(() => {
      const headerEl = document.querySelector<HTMLElement>("[data-site-header]");
      const headerH = headerEl?.offsetHeight ?? 0;
      const rect = el.getBoundingClientRect();
      const currentScroll =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      const targetY = currentScroll + rect.top - headerH - 8;
      window.scrollTo({ top: targetY, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [latestUserId]);

  const pendingUserMessage: ChatMessageDto | null = pendingUserText
    ? {
        id: PENDING_USER_ID,
        role: "USER",
        content: pendingUserText,
        createdAt: new Date().toISOString(),
        metadata: null,
      }
    : null;

  const empty = messages.length === 0 && !pendingUserText;
  if (empty) return null;

  return (
    <div className="flex w-full min-w-0 flex-col">
      <ChatColumn shellClassName="py-4" columnClassName="flex flex-col gap-4">
        {messages.map((m) => {
          const assignRef =
            m.id === latestUserId
              ? lastUserRef
              : m.id === latestAssistantId
                ? lastAssistantRef
                : undefined;
          return (
            <div key={m.id} ref={assignRef} className="w-full">
              <MessageBubble
                message={m}
                assistantStream={
                  m.role === "ASSISTANT" && m.id === streamingAssistantMessageId
                    ? {
                        onComplete: () => onAssistantStreamComplete?.(),
                        interruptNonce: streamInterruptNonce,
                        onInterrupted: (partial) =>
                          onAssistantStreamInterrupted?.(partial),
                        onStreamProgress: onAssistantStreamProgress,
                      }
                    : undefined
                }
              />
            </div>
          );
        })}
        {pendingUserMessage && (
          <div
            key={PENDING_USER_ID}
            ref={latestUserId === PENDING_USER_ID ? lastUserRef : undefined}
            className="w-full"
          >
            <MessageBubble message={pendingUserMessage} />
          </div>
        )}
        {pendingUserText && awaitingAssistant ? <AssistantLoadingBubble /> : null}
      </ChatColumn>
      {/* Spacer: allows anchoring the last user message at the top; shrinks as the assistant reply grows. */}
      <div
        aria-hidden
        className="w-full shrink-0"
        style={{ height: `${spacerH}px` }}
      />
    </div>
  );
}
