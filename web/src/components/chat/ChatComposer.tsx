"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ChatColumn } from "./ChatColumn";
import { NewsDatePicker } from "./NewsDatePicker";

const TEXTAREA_MAX_PX = 200;

type Props = {
  date: string;
  onDateChange: (v: string) => void;
  onSend: (message: string) => void | Promise<void>;
  onNewChat: () => void;
  disabled: boolean;
  /** When set, applies only to the “Nuova chat” button (e.g. stays clickable while generating). */
  newChatDisabled?: boolean;
  loadingLabel?: string;
  /** While waiting for a reply or streaming: send becomes Stop. */
  showStop?: boolean;
  onStop?: () => void;
  /** `dock` = bottom bar with an active thread; `center` = empty state with no messages */
  placement?: "dock" | "center";
};

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function ChatComposer({
  date,
  onDateChange,
  onSend,
  onNewChat,
  disabled,
  newChatDisabled,
  loadingLabel,
  showStop = false,
  onStop,
  placement = "dock",
}: Props) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const isSending = loadingLabel === "Invio…";

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_PX)}px`;
  }, [text]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (disabled || !text.trim()) return;
    const msg = text;
    setText("");
    await onSend(msg);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    void handleSubmit();
  }

  const shellClass =
    placement === "center"
      ? "w-full bg-transparent py-2"
      : "sticky bottom-0 z-20 w-full shrink-0 border-t border-zinc-200 bg-zinc-50/95 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95";

  return (
    <div
      className={shellClass}
      data-chat-composer={placement === "dock" ? "" : undefined}
    >
      <ChatColumn columnClassName="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <NewsDatePicker value={date} onChange={onDateChange} disabled={disabled} />
          <button
            type="button"
            onClick={onNewChat}
            disabled={newChatDisabled ?? disabled}
            className="ml-auto cursor-pointer rounded-lg border border-tongue-ai bg-tongue-ai px-3 py-1.5 text-sm font-medium text-white transition-colors hover:border-zinc-300 hover:bg-white hover:text-zinc-800 disabled:cursor-default disabled:opacity-50 dark:border-tongue-ai dark:bg-tongue-ai dark:text-white dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            Nuova chat
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div
            className="flex min-h-[52px] items-end gap-2 rounded-3xl border border-zinc-300 bg-white px-3 py-2 shadow-sm ring-1 ring-black/5 transition-[box-shadow,border-color,ring-color,ring-width] has-[textarea:focus]:border-tongue-ai has-[textarea:focus]:shadow-md has-[textarea:focus]:ring-2 has-[textarea:focus]:ring-tongue-ai/25 dark:border-zinc-600 dark:bg-zinc-900 dark:ring-white/10 dark:has-[textarea:focus]:border-tongue-ai dark:has-[textarea:focus]:ring-tongue-ai/30"
          >
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Chiedi a Tongue…"
              rows={1}
              disabled={disabled}
              maxLength={4000}
              className="min-h-[36px] max-h-[200px] min-w-0 flex-1 resize-none border-0 bg-transparent py-2 pl-1 text-base leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:opacity-60 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              aria-label="Messaggio"
            />
            <button
              type={showStop ? "button" : "submit"}
              data-sending={isSending || undefined}
              disabled={showStop ? false : disabled || !text.trim()}
              onClick={
                showStop
                  ? (e) => {
                      e.preventDefault();
                      onStop?.();
                    }
                  : undefined
              }
              className="mb-0.5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-tongue-ai text-white shadow-sm ring-1 ring-black/15 transition-[transform,box-shadow,filter] hover:brightness-[1.06] hover:shadow-md active:scale-[0.97] disabled:cursor-default disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-sm disabled:ring-black/5 disabled:hover:brightness-100 disabled:active:scale-100 data-sending:disabled:bg-tongue-ai data-sending:disabled:text-white data-sending:disabled:ring-black/15 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 dark:data-sending:disabled:bg-tongue-ai"
              aria-label={showStop ? "Interrompi" : loadingLabel ?? "Invia"}
            >
              {showStop ? (
                <StopIcon className="h-7 w-7" />
              ) : isSending ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
              ) : (
                <SendIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="px-1 text-center text-xs text-zinc-400 dark:text-zinc-500 sm:text-left">
            Invio per inviare · Maiusc+Invio per andare a capo
            {showStop ? " · Clicca il pulsante per interrompere" : ""}
          </p>
        </form>
      </ChatColumn>
    </div>
  );
}
