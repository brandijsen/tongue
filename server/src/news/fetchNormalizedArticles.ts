import { envIsTruthy } from "../lib/envTruthy";
import { runProviderCascade } from "./cascade";
import { getMockArticles } from "./mock";
import type { NewsFetchParams, NormalizedArticle } from "./types";

export type { NewsFetchParams, NormalizedArticle } from "./types";

export function isMockNewsEnabled(): boolean {
  return envIsTruthy("USE_MOCK_NEWS");
}

/**
 * Normalized articles for the chat turn. Mock path avoids external APIs; real path uses PS2 cascade (adapters TBD).
 */
export async function fetchNormalizedArticles(params: NewsFetchParams): Promise<NormalizedArticle[]> {
  if (isMockNewsEnabled()) {
    return getMockArticles(params);
  }
  return runProviderCascade(params);
}
