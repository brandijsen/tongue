import Image from "next/image";

export function SiteHeader() {
  return (
    <header
      data-site-header
      className="sticky top-0 z-30 shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="inline-block">
          <Image
            src="/brand/tongue-logo-wordmark.png"
            alt="Tongue"
            width={560}
            height={135}
            className="h-12 w-auto sm:h-13 md:h-14 lg:h-16"
            priority
          />
        </div>
      </div>
    </header>
  );
}
