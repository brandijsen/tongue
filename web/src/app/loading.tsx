import { TongueRouteLoadingShell } from "@/components/chat/TongueRouteLoadingShell";

/**
 * Global loading (`app/` segment): home `/`, requests that pass through this slot, and
 * initial streaming navigation. Same look everywhere (white + spinner).
 */
export default function AppSegmentLoading() {
  return <TongueRouteLoadingShell statusLabel="Caricamento in corso" />;
}
