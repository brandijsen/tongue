# Tongue

Monorepo **scheletro**: API Express (`server/`), app Next.js (`web/`), persistenza con **PostgreSQL** + **Prisma**. **Fase 3 (scheletro):** CORS, `POST /api/chat` (`chat` + `loadHistory`), validazione Zod, persistenza USER/ASSISTANT con risposta ASSISTANT segnaposto (`metadata.stub`); nessun fetch notizie, selettore PF8 né OpenAI.

## Avvio locale

1. `cp server/.env.example server/.env` e `cp web/.env.example web/.env.local`, poi imposta `DATABASE_URL`.
2. Da `server/`: `npm install`, `npx prisma migrate dev`, `npm run dev` (default porta **4000**, `GET /health`).
3. Da `web/`: `npm install`, `npm run dev` (default **3000**). `NEXT_PUBLIC_API_URL` deve puntare all’API.

## Layout

| Cartella   | Stack                          |
|------------|--------------------------------|
| `web/`     | Next.js (App Router), TypeScript |
| `server/`  | Express, TypeScript, Prisma    |

## License

Vedi [LICENSE](LICENSE) se presente.
