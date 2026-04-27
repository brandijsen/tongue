import Link from "next/link";
import { TONGUE_FILLED_CTA_CLASSNAME } from "@/lib/tongueCtaButton";

/**
 * 404: unknown routes (e.g. /ciao, /chat/ciao) — root layout and header are from root `layout.tsx`
 */
export default function NotFound() {
  return (
    <main className="flex min-w-0 flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-10">
        <div className="space-y-5">
          <h1 className="space-y-3">
            <span className="block text-6xl font-bold tabular-nums leading-none tracking-tight text-tongue-ai sm:text-7xl md:text-8xl">
              404
            </span>
            <span className="block text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              Pagina non trovata
            </span>
          </h1>
          <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-lg">
            Questo indirizzo non corrisponde a una pagina di Tongue. Controlla il link o torna
            all&apos;inizio per continuare.
          </p>
        </div>

        <Link
          href="/"
          className={`${TONGUE_FILLED_CTA_CLASSNAME} no-underline`}
        >
          Torna a Tongue
        </Link>
      </div>
    </main>
  );
}
