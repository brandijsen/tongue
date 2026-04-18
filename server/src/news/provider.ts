import type { NewsProviderId, NormalizedArticle } from "./types";

/** Shared adapter input (`date` = requested calendar day, YYYY-MM-DD). */
export type FetchArticlesParams = {
  message: string;
  date: string;
};

export type NewsProviderErrorCode = "HTTP" | "QUOTA" | "PARSE" | "CONFIG";

/**
 * Typed error from an adapter; the cascade may log and try the next provider.
 */
export class NewsProviderError extends Error {
  readonly providerId: NewsProviderId;
  readonly code: NewsProviderErrorCode;
  readonly httpStatus?: number;

  constructor(
    message: string,
    options: {
      providerId: NewsProviderId;
      code: NewsProviderErrorCode;
      httpStatus?: number;
    },
  ) {
    super(message);
    this.name = "NewsProviderError";
    this.providerId = options.providerId;
    this.code = options.code;
    this.httpStatus = options.httpStatus;
  }
}

/**
 * Each provider module implements this contract: one method returning normalized rows.
 */
export type NewsProvider = {
  readonly id: NewsProviderId;
  fetchArticles(params: FetchArticlesParams): Promise<NormalizedArticle[]>;
};
