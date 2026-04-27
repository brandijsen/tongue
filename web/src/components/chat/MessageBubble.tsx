"use client";

import { useCallback, useState } from "react";
import type { ChatMessageDto } from "@/types/chat";
import { AssistantSources } from "./AssistantSources";
import { StreamingText } from "./StreamingText";

type Props = {
  message: ChatMessageDto;
  /** When set, assistant text is revealed character-by-character (LLM-style streaming). */
  assistantStream?: {
    onComplete: () => void;
    interruptNonce: number;
    onInterrupted: (partial: string) => void;
    onStreamProgress?: (partial: string) => void;
  };
};

export function MessageBubble({ message, assistantStream }: Props) {
  const isUser = message.role === "USER";
  const streamAssist = !isUser && assistantStream != null;
  const [streamFinished, setStreamFinished] = useState(!streamAssist);

  const handleStreamComplete = useCallback(() => {
    setStreamFinished(true);
    assistantStream?.onComplete();
  }, [assistantStream]);

  const handleInterrupted = useCallback(
    (partial: string) => {
      setStreamFinished(true);
      assistantStream?.onInterrupted(partial);
    },
    [assistantStream],
  );

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 text-left text-base leading-[1.65] ${
          isUser
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-300 dark:text-zinc-950"
            : "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : streamAssist ? (
          <StreamingText
            text={message.content}
            interruptNonce={assistantStream.interruptNonce}
            onComplete={handleStreamComplete}
            onInterrupted={handleInterrupted}
            onStreamProgress={assistantStream.onStreamProgress}
          />
        ) : (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}
        {!isUser && streamFinished && <AssistantSources metadata={message.metadata} />}
      </div>
    </div>
  );
}
