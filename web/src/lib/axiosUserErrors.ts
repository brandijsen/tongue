import { isAxiosError } from "axios";

export function isUserAbortError(e: unknown): boolean {
  if (!isAxiosError(e)) return false;
  if (e.code === "ERR_CANCELED") return true;
  return e.message === "canceled" || e.message === "CanceledError";
}

/** True when the API returns 404 (e.g. unknown `sessionId`). */
export function isNotFoundError(e: unknown): boolean {
  return isAxiosError(e) && e.response?.status === 404;
}

/** When the server does not return `{ error: "..." }`, map typical English Axios messages to Italian for the UI. */
function axiosMessageForLocale(msg: string, code?: string): string {
  const m = msg.trim();
  if (m === "Network Error" || /network error/i.test(m) || code === "ERR_NETWORK") {
    return "Connessione non riuscita. Controlla la rete e riprova.";
  }
  if (code === "ECONNABORTED" || /timeout.*exceeded/i.test(m) || m.includes("ETIMEDOUT")) {
    return "La richiesta ha impiegato troppo tempo. Riprova.";
  }
  if (/Request failed with status code/i.test(m)) {
    return "Il server non ha risposto correttamente. Riprova.";
  }
  return msg;
}

/** User-facing message: `error` from server JSON if present, else known localized string, else generic. */
export function axiosErrorMessageForUser(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: string } | undefined;
    if (data?.error && typeof data.error === "string") return data.error;
    if (e.message) return axiosMessageForLocale(e.message, e.code);
  }
  if (e instanceof Error) {
    return axiosMessageForLocale(e.message);
  }
  return "Si è verificato un errore. Riprova.";
}
