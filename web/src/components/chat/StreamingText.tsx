"use client";

import { startTransition, useEffect, useRef, useState } from "react";

/** Per-character delay for the “typing” effect (wall clock). ~15 ms ≈ 65 c/s — faster than the old 31 ms (~32 c/s). */
const MS_PER_CHAR = 15;

const PROGRESS_THROTTLE_MS = 150;

type Props = {
  text: string;
  onComplete: () => void;
  /** Increment to stop immediately and keep only the text already shown. */
  interruptNonce: number;
  onInterrupted?: (partial: string) => void;
  /**
   * While revealing text, report the currently visible prefix (throttled) so the parent
   * can persist it (e.g. sessionStorage) — same as server full body still exists, but
   * refresh can restore only what was visible, not the whole answer.
   */
  onStreamProgress?: (partial: string) => void;
};

/**
 * “Streaming” display driven by elapsed real time, not by counting interval ticks.
 * Background tabs heavily throttle setInterval; using Date.now() per frame keeps the
 * visible prefix in sync when the user returns, without restarting from the first char.
 */
export function StreamingText({
  text,
  onComplete,
  interruptNonce,
  onInterrupted,
  onStreamProgress,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const onInterruptedRef = useRef(onInterrupted);
  const onStreamProgressRef = useRef(onStreamProgress);
  const lastProgressEmitRef = useRef(0);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onInterruptedRef.current = onInterrupted;
    onStreamProgressRef.current = onStreamProgress;
  }, [onComplete, onInterrupted, onStreamProgress]);

  const visibleCountRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const streamStartMsRef = useRef(0);
  const completedRef = useRef(false);
  const prevInterruptRef = useRef(0);

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  useEffect(() => {
    if (text.length === 0) {
      onCompleteRef.current();
      return;
    }

    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    streamStartMsRef.current = Date.now();
    completedRef.current = false;
    startTransition(() => setVisibleCount(0));
    visibleCountRef.current = 0;

    const emitProgress = (n: number) => {
      if (!onStreamProgressRef.current || n <= 0) return;
      const now = Date.now();
      if (now - lastProgressEmitRef.current >= PROGRESS_THROTTLE_MS) {
        lastProgressEmitRef.current = now;
        onStreamProgressRef.current(text.slice(0, n));
      }
    };

    const tick = () => {
      const elapsed = Date.now() - streamStartMsRef.current;
      const n = Math.min(text.length, Math.max(0, Math.floor(elapsed / MS_PER_CHAR)));
      if (n !== visibleCountRef.current) {
        visibleCountRef.current = n;
        setVisibleCount(n);
        emitProgress(n);
      }
      if (n >= text.length) {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
        rafIdRef.current = null;
        return;
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [text]);

  useEffect(() => {
    if (interruptNonce === 0) {
      prevInterruptRef.current = 0;
      return;
    }
    if (interruptNonce === prevInterruptRef.current) return;
    prevInterruptRef.current = interruptNonce;

    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const partial = text.slice(0, visibleCountRef.current);
    if (partial.length < text.length) {
      onInterruptedRef.current?.(partial);
    }
  }, [interruptNonce, text]);

  /** If the user leaves or reloads before the animation finishes, sync the last visible prefix. */
  useEffect(() => {
    if (text.length === 0) return;

    const flush = () => {
      const n = visibleCountRef.current;
      if (n < text.length) {
        onStreamProgressRef.current?.(text.slice(0, n));
      }
    };

    const onPageHide = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [text]);

  const shown = text.slice(0, visibleCount);
  const done = visibleCount >= text.length;

  return (
    <span className="whitespace-pre-wrap">
      {shown}
      {!done && (
        <span
          className="ml-px inline-block min-h-[1em] w-px animate-pulse bg-tongue-ai align-[-0.15em]"
          aria-hidden
        />
      )}
    </span>
  );
}
