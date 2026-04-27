import { TongueRouteLoadingShell } from "@/components/chat/TongueRouteLoadingShell";

/**
 * `/chat` segment loading (first visit and every client navigation to /chat).
 */
export default function ChatSegmentLoading() {
  return <TongueRouteLoadingShell statusLabel="Caricamento in corso" />;
}
