type TongueRouteLoadingShellProps = {
  /**
   * Screen reader text (e.g. in chat: history still syncing).
   * Default is neutral; pass a contextual label when needed.
   */
  statusLabel?: string;
  className?: string;
};

/**
 * Loading surface: full white background, orange spinner centered (no visible under-layer).
 * Used by `TongueChatPage` (bootstrap), `app/loading` and `app/chat/loading` (Next).
 */
export function TongueRouteLoadingShell({
  statusLabel = "Caricamento in corso",
  className,
}: TongueRouteLoadingShellProps) {
  return (
    <div
      className={
        "flex min-h-0 w-full min-w-0 flex-1 flex-col bg-white" + (className ? ` ${className}` : "")
      }
    >
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">{statusLabel}</span>
        <div
          className="h-12 w-12 shrink-0 animate-spin rounded-full border-[3px] border-tongue-ai border-t-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
