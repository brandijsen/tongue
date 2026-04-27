import assert from "node:assert/strict";
import test from "node:test";
import { articlesToMetadataRows, metadataRowsToNormalized } from "../news/articleMetadata";
import type { NormalizedArticle } from "../news/types";
import { buildNewsAssistantMessageMetadata } from "./assistantMessageMetadata";

function sampleArticle(i: number): NormalizedArticle {
  return {
    title: `Title ${i}`,
    url: `https://example.com/a${i}`,
    excerpt: "x".repeat(100),
    providerId: "gnews",
    publishedAt: new Date("2025-01-15T12:00:00.000Z"),
  };
}

test("metadata roundtrip preserves URL set (sources UI ↔ stored rows)", () => {
  const articles = [sampleArticle(1), sampleArticle(2)];
  const rows = articlesToMetadataRows(articles);
  const back = metadataRowsToNormalized(rows, "2025-01-15");
  assert.equal(back.length, articles.length);
  assert.deepEqual(
    new Set(back.map((a) => a.url)),
    new Set(articles.map((a) => a.url)),
  );
});

test("buildNewsAssistantMessageMetadata empty = zero synthesis sources (no relevant articles path)", () => {
  const m = buildNewsAssistantMessageMetadata({
    date: "2025-01-15",
    articles: [],
    summaryPending: false,
    showSources: false,
  });
  assert.equal(m.articles.length, 0);
  assert.equal(m.showSources, false);
});

test("buildNewsAssistantMessageMetadata mirrors article count for non-empty bundle", () => {
  const articles = [sampleArticle(0)];
  const m = buildNewsAssistantMessageMetadata({
    date: "2025-01-15",
    articles,
    summaryPending: false,
    showSources: true,
  });
  assert.equal(m.articles.length, 1);
  assert.equal(m.showSources, undefined);
});
