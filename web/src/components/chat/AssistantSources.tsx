"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import type { ArticleSourceDto, AssistantMessageMetadata } from "@/types/chat";

function parseMetadata(raw: unknown): AssistantMessageMetadata | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.date !== "string" || !Array.isArray(o.articles)) return null;
  return o as unknown as AssistantMessageMetadata;
}

/** Delay between showing one source and the next (ms). */
const STAGGER_MS = 240;

type Props = {
  metadata: unknown | null;
};

function sourcesStabilityKey(metadata: unknown | null): string {
  const parsed = parseMetadata(metadata);
  if (!parsed) return "0|";
  const { articles, summaryPending, showSources } = parsed;
  if (articles.length === 0) return "0|";
  const urls = articles.map((a) => a.url).sort();
  return `${articles.length}|${summaryPending ? "p" : ""}|${showSources === false ? "0" : "1"}|${urls.join("\u0001")}`;
}

export function AssistantSources({ metadata }: Props) {
  const parsed = parseMetadata(metadata);
  const articles = parsed?.articles ?? [];
  const [visibleCount, setVisibleCount] = useState(0);
  const intervalRef = useRef<number | null>(null);

  /** `metadata` references change on every parent `setMessages`; cascade only re-runs when sources actually change (same string = no re-run). */
  const sourcesIdentityKey = sourcesStabilityKey(metadata);

  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (parsed?.showSources === false) {
      startTransition(() => setVisibleCount(0));
      return;
    }

    if (articles.length === 0) {
      startTransition(() => setVisibleCount(0));
      return;
    }

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      startTransition(() => setVisibleCount(articles.length));
      return;
    }

    startTransition(() => setVisibleCount(1));
    if (articles.length <= 1) return;

    let shown = 1;
    intervalRef.current = window.setInterval(() => {
      shown += 1;
      startTransition(() => setVisibleCount(shown));
      if (shown >= articles.length && intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, STAGGER_MS);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sourcesIdentityKey, articles.length, parsed?.showSources]);

  if (!parsed || articles.length === 0) return null;
  if (parsed.showSources === false) return null;

  const visible = articles.slice(0, visibleCount);

  return (
    <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Fonti:
      </p>
      <ul className="space-y-2">
        {visible.map((a: ArticleSourceDto, i: number) => (
          <li
            key={`${a.url}-${i}`}
            className="text-left text-sm animate-[assistant-source-reveal_0.35s_ease-out_both] motion-reduce:animate-none"
          >
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-tongue-ai underline underline-offset-2 decoration-[color-mix(in_srgb,var(--tongue-ai)_40%,transparent)] transition-[filter,box-shadow] hover:brightness-[1.07] focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--tongue-ai)_45%,transparent)] focus-visible:ring-offset-2 dark:decoration-[color-mix(in_srgb,var(--tongue-ai)_50%,transparent)] dark:focus-visible:ring-offset-zinc-900"
            >
              {a.title}
            </a>
            <span className="text-zinc-500 dark:text-zinc-400">
              {" "}
              — {a.source ?? a.providerId}
            </span>
          </li>
        ))}
      </ul>
      {parsed.summaryPending === true && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Sintesi non generata: imposta OPENAI_API_KEY sul server per il riassunto completo.
        </p>
      )}
    </div>
  );
}
