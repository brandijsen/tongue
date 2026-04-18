export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-24 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tongue</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Backend in scheletro: <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">GET /health</code> e{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">POST /api/chat</code> (risposta segnaposto). UI chat in fase 4.
      </p>
    </main>
  );
}
