"use client";

import { useTongueChat } from "@/hooks/useTongueChat";
import { isApiConfigured } from "@/lib/api";
import { ChatComposer } from "./ChatComposer";
import { MessageList } from "./MessageList";
import { TongueRouteLoadingShell } from "./TongueRouteLoadingShell";

export function TongueChatPage() {
  const {
    hydrated,
    headerOnlyShell,
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
  } = useTongueChat();

  const apiMissing = !isApiConfigured();
  const generationBusy = isSending || streamingAssistantMessageId != null;
  const busy = headerOnlyShell || generationBusy;
  const composerDisabled = apiMissing || busy;
  const newChatDisabled = apiMissing || headerOnlyShell;
  const showStopButton =
    !apiMissing && hydrated && !isLoadingHistory && generationBusy;

  let loadingLabel: string | undefined;
  if (isSending) loadingLabel = "Invio…";
  else if (isLoadingHistory) loadingLabel = "Sincronizzazione…";

  const hasThread =
    messages.length > 0 || (pendingUserText != null && pendingUserText.length > 0);
  const showMessageThread = hydrated && !isLoadingHistory && hasThread;

  const composerProps = {
    date,
    onDateChange: setDate,
    onSend: sendMessage,
    onNewChat: newChat,
    disabled: composerDisabled,
    newChatDisabled,
    loadingLabel,
    showStop: showStopButton,
    onStop: stopGeneration,
  } as const;

  if (headerOnlyShell) {
    return <TongueRouteLoadingShell statusLabel="Sincronizzazione conversazione" />;
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">
      {apiMissing && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Imposta <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">NEXT_PUBLIC_API_URL</code> in{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">.env.local</code> (es.{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">http://localhost:4000</code>) e riavvia{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">npm run dev</code>.
        </div>
      )}

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <button
            type="button"
            onClick={() => setError(null)}
            className="float-right ml-2 cursor-pointer text-xs underline"
          >
            Chiudi
          </button>
          {error}
        </div>
      )}

      {showMessageThread ? (
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <MessageList
            messages={messages}
            pendingUserText={pendingUserText}
            awaitingAssistant={isSending}
            streamingAssistantMessageId={streamingAssistantMessageId}
            streamInterruptNonce={streamInterruptNonce}
            onAssistantStreamComplete={endAssistantStream}
            onAssistantStreamInterrupted={freezeAssistantAtPartial}
            onAssistantStreamProgress={persistAssistantStreamProgress}
          />
          <ChatComposer {...composerProps} placement="dock" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-stretch justify-center gap-10 px-0 py-8 sm:gap-12 sm:py-12">
          <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-800 sm:text-2xl dark:text-zinc-100">
              Cosa vuoi sapere?
            </h2>
            <p className="mt-3 max-w-xl mx-auto text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
              Imposta la data per una nuova ricerca notizie, scrivi e invia. Dopo ogni risposta la data si
              azzera: puoi approfondire le fonti senza data, oppure rimetterla per cercare di nuovo.
            </p>
          </div>
          <ChatComposer {...composerProps} placement="center" />
        </div>
      )}
    </div>
  );
}
