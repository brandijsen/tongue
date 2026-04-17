/** PS2: internal shape used by cascade + LLM + ASSISTANT metadata. */
export type NormalizedArticle = {
  title: string;
  url: string;
  /** ISO 8601 */
  publishedAt: string;
  excerpt: string;
  sourceName?: string;
  /** Stable id: newsdata | thenewsapi | worldnewsapi | mock | … */
  providerId: string;
};

export type NewsFetchParams = {
  message: string;
  date: string;
  sinceTime?: string;
  timeZone?: string;
};
