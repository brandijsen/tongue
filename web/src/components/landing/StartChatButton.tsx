"use client";

import Link from "next/link";
import { TONGUE_FILLED_CTA_CLASSNAME } from "@/lib/tongueCtaButton";
import { TONGUE_SESSION_STORAGE_KEY } from "@/lib/tongueSession";

/**
 * `Link` to /chat: navigation works with Next prefetch, middle-click, etc.
 * onClick: clear the session like “New chat” elsewhere.
 */
export function StartChatButton() {
  return (
    <Link
      href="/chat"
      onClick={() => {
        try {
          window.localStorage.removeItem(TONGUE_SESSION_STORAGE_KEY);
        } catch {
          /* ignore private mode / quota */
        }
      }}
      className={`${TONGUE_FILLED_CTA_CLASSNAME} no-underline`}
    >
      Nuova chat
    </Link>
  );
}
