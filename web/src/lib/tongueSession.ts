/** `localStorage` key for `sessionId` — keep in sync with server / useTongueChat. */
export const TONGUE_SESSION_STORAGE_KEY = "tongue_session_id";

/**
 * `sessionStorage` (namespaced by sessionId): map `messageId` → truncated text when the user
 * stops client-side “streaming”, so full server messages do not reappear in the UI
 * on a later turn or refresh in the same tab.
 */
export const TONGUE_FROZEN_ASSISTANT_KEY_PREFIX = "tongue_frozen_assistant:";

export function tongueFrozenAssistantStorageKey(sessionId: string): string {
  return `${TONGUE_FROZEN_ASSISTANT_KEY_PREFIX}${sessionId}`;
}
