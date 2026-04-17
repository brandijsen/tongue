import type { NewsFetchParams, NormalizedArticle } from "./types";

/** Fixture articles tagged with the requested calendar day (no real HTTP). */
export function getMockArticles(params: NewsFetchParams): NormalizedArticle[] {
  const noonUtc = `${params.date}T12:00:00.000Z`;
  const eveningUtc = `${params.date}T18:30:00.000Z`;

  return [
    {
      title: "[Mock] Aggiornamento su energia e mercati",
      url: "https://example.com/mock/energy-markets",
      publishedAt: noonUtc,
      excerpt:
        "Breve sintesi fittizia per sviluppo locale: USE_MOCK_NEWS evita chiamate verso provider esterni.",
      sourceName: "Mock Aggregator",
      providerId: "mock",
    },
    {
      title: "[Mock] Tecnologia: nuove linee guida UE",
      url: "https://example.com/mock/eu-tech-guidelines?utm=track",
      publishedAt: eveningUtc,
      excerpt:
        "Secondo articolo di esempio con URL da normalizzare in dedup (query string ignorata in chiave).",
      sourceName: "Mock Tech Daily",
      providerId: "mock",
    },
  ];
}
