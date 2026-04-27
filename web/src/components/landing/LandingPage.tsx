import { StartChatButton } from "./StartChatButton";

export function LandingPage() {
  return (
    <main className="flex min-w-0 flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-10">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            Tongue — notizie in sintesi
          </h1>
          <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-lg">
            Scegli una data, scrivi cosa vuoi sapere sulle notizie e ricevi un riassunto chiaro, con le{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-300">fonti originali</span> a
            disposizione per verificare titoli e contenuti.
          </p>
        </div>

        <StartChatButton />
      </div>
    </main>
  );
}
