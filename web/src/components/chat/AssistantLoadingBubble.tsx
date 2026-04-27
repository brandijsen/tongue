"use client";

/** “Typing” indicator, aligned with Tongue assistant message styling. */
export function AssistantLoadingBubble() {
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[min(100%,42rem)] rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <div
          className="flex items-center gap-1.5 py-0.5"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Risposta in arrivo…</span>
          <span className="h-2 w-2 animate-[bounce_1.05s_ease-in-out_infinite] rounded-full bg-tongue-ai" />
          <span className="h-2 w-2 animate-[bounce_1.05s_ease-in-out_infinite] rounded-full bg-tongue-ai [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-[bounce_1.05s_ease-in-out_infinite] rounded-full bg-tongue-ai [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
