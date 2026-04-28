import Image from "next/image";

/** Wordmark from presentation asset (`ppt/media/image1.png` → `public/logo.png`). */
export function SiteHeader() {
  return (
    <header
      data-site-header
      className="sticky top-0 z-30 shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="inline-flex items-center">
          <Image
            src="/logo.png"
            alt="Tongue"
            width={365}
            height={204}
            className="h-20 w-auto sm:h-[5rem] md:h-[5.75rem] lg:h-24 xl:h-[7rem]"
            priority
          />
        </div>
      </div>
    </header>
  );
}
