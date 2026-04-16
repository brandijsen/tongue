# Tongue

Conversational news assistant: pick a date (and optional time window), ask in natural language; the backend fetches articles via a **hybrid cascade** of news APIs, persists chat in **PostgreSQL** (Prisma), and returns grounded summaries through **OpenAI**.

## What is Phase 1 (repo baseline)?

Per the project spec, Phase 1 means:

1. **Monorepo** with `web/` (Next.js) and `server/` (Express), separate `package.json` files.
2. **Environment templates** — [`web/.env.example`](web/.env.example), [`server/.env.example`](server/.env.example) — no secrets committed.
3. **`.gitignore`** at repo root (and per package as needed) so local env and build output stay out of Git.
4. **README** — this file — including **news provider** documentation (docs, terms, rough free-tier notes), **attribution** rules, optional **`USE_MOCK_NEWS`** for dev, and **Supabase / Prisma** connection notes.

Implementation of `POST /api/chat`, migrations, and UI comes in later phases.

## Monorepo layout

| Path | Stack |
|------|--------|
| [`web/`](web/) | Next.js (App Router), TypeScript, Tailwind, Axios |
| [`server/`](server/) | Express, TypeScript, Prisma, OpenAI SDK |

The chat API will be a single route: **`POST /api/chat`** (modes: default `chat` and `loadHistory` in the JSON body). The web app calls it via `NEXT_PUBLIC_API_URL` (no trailing slash).

## Quick start (local)

1. Copy env files:  
   `cp web/.env.example web/.env.local`  
   `cp server/.env.example server/.env`  
   Then fill in real values (see tables below).

2. **API:** `cd server && npm run dev` — default <http://localhost:4000> (`GET /health` for probes).

3. **Web:** `cd web && npm run dev` — default <http://localhost:3000>.

4. **Database:** with `DATABASE_URL` set, from `server/`:  
   `npx prisma migrate dev` (creates tables from [`server/prisma/schema.prisma`](server/prisma/schema.prisma)).

## Environment variables (summary)

| Scope | Variables |
|-------|-----------|
| **web** | `NEXT_PUBLIC_API_URL` — Express base URL (e.g. `http://localhost:4000`). |
| **server** | `PORT`, `CORS_ORIGIN`, `DATABASE_URL`, optional `DIRECT_URL` (pooler + Prisma), `OPENAI_API_KEY`, optional `OPENAI_MODEL`, news keys (`NEWSDATA_API_KEY`, `THENEWSAPI_KEY`, `WORLDNEWS_API_KEY`), `NEWS_PROVIDER_ORDER`, `MIN_ARTICLES_BEFORE_NEXT_PROVIDER`, `MAX_ARTICLES_FOR_PROMPT`, optional `USE_MOCK_NEWS`. |

Details and placeholders: [`server/.env.example`](server/.env.example).

## News providers (cascade)

The backend is designed to try providers in **`NEWS_PROVIDER_ORDER`** (comma-separated ids). Missing API keys skip that provider. **Hybrid cascade:** if a provider hits quota or returns too few articles after filters, the next provider may run (see project spec / PS2).

### Provider reference (verify limits on official pricing pages)

| Provider id | Role | Documentation | Terms / policy |
|-------------|------|---------------|----------------|
| `newsdata` | Aggregated news, many sources | [NewsData.io](https://newsdata.io/) | [Terms](https://newsdata.io/terms-and-conditions) |
| `thenewsapi` | Aggregated search / top stories | [TheNewsAPI](https://www.thenewsapi.com/) | [Terms](https://www.thenewsapi.com/terms-and-conditions) |
| `worldnewsapi` | Global news, semantic filters | [World News API](https://worldnewsapi.com/) | [Terms](https://worldnewsapi.com/terms/) |

**Typical free-tier constraints (must confirm on each site):** daily request or “point” caps, delays on free plans (e.g. headlines not real-time), and **World News API** free tier may require a **backlink** to their site in your app or docs — check current pricing.

### Attribution (multi-provider)

When showing titles, snippets, or links:

- Show the **original article URL** from the API and the **source / outlet name** when available (`sourceName` in normalized articles).
- Do **not** label all content as if it came from a single brand; data may come from multiple outlets via different aggregators.

### Development: mock news

Set **`USE_MOCK_NEWS=true`** in `server/.env` once the news service supports it to avoid burning real API quotas during hot reload (fixture JSON). Omit or `false` for real integrations.

## Database: Supabase + Prisma

- **Default:** one **`DATABASE_URL`** using Supabase **direct** PostgreSQL (host like `db.<project>.supabase.co`, port **5432**) for both `prisma migrate` and runtime. See [Prisma + Supabase](https://www.prisma.io/docs/orm/overview/databases/supabase).

- **Pooler (PgBouncer, e.g. port 6543):** use the pooler URL for app traffic and set **`DIRECT_URL`** to the direct URI for migrations; add `directUrl = env("DIRECT_URL")` in `schema.prisma` when you switch — document both vars in `.env.example` (already stubbed).

## Production deploy (preview)

| Service | Role |
|---------|------|
| **Supabase** | PostgreSQL |
| **Render** | `server/` — build should run `prisma generate`, `prisma migrate deploy`, then compile; start with `npm start` on `PORT`. |
| **Vercel** | `web/` — set `NEXT_PUBLIC_API_URL` to the Render API URL (HTTPS, no trailing slash). |

Exact build/start lines are repeated in the spec (PS6); align `CORS_ORIGIN` with your Vercel URL(s).

## License

See [LICENSE](LICENSE) if present in the repo.
