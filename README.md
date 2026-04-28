# Tongue

Monorepo con **API Express** (`server/`), **app Next.js** (`web/`) e persistenza **PostgreSQL** tramite **Prisma**. L’interfaccia di chat passa da **un solo** `POST /api/chat` (turni e `loadHistory` con `action: "loadHistory"` nel JSON, senza un GET separato per l’elenco messaggi). Il backend integra una **cascata** di provider notizie, un **selettore a rilevanza** (LLM) e la **sintesi** con OpenAI.

## Prerequisiti

- **Node.js** 20+ (consigliato) e `npm`
- **PostgreSQL** raggiungibile (locale o hostato, es. Supabase)

## Struttura

| Path       | Contenuto |
|------------|-----------|
| `server/`  | Express, TypeScript, Prisma, news cascade, OpenAI |
| `web/`     | Next.js (App Router), TypeScript, client chat |
| `server/prisma/` | Schema e migrazioni database |

### Installazione sul PC del relatore (valutatore)

Chi deve **solo eseguire** il progetto sulla propria macchina dopo il clone può seguire questo ordine (Windows, macOS e Linux con shell Bash o Git Bash su Windows):

1. **Ambiente**: **Node.js 20+**, **npm** e **Git**. Serve un database **PostgreSQL raggiungibile**: in alternativa locale/Docker o un progetto gratis **Supabase** ([dashboard](https://supabase.com/dashboard)) seguendo le URI descritte sotto nella sezione *Database*.

2. **Clone del repository** e ingresso nella root del monorepo:
   ```bash
   git clone https://github.com/brandijsen/tongue.git
   cd tongue
   ```

3. **Copia degli esempio env** (i file `.env` e `.env.local` **non** sono nel repo; si partono dai template senza segreti):
   ```bash
   cp server/.env.example server/.env
   cp web/.env.example web/.env.local
   ```

4. Modifica **`server/.env`** inserendo almeno:
   - **`DATABASE_URL`** e **`DIRECT_URL`** (vedi più sotto per Supabase o Postgres locale; in locale spesso sono **identiche**).
   - Opzionale ma consigliato per prove complete: **`OPENAI_API_KEY`**. Senza chiave il backend resta utilizzabile con comportamenti degradati sulla sintesi.
   - Opzionale: **`USE_MOCK_NEWS=true`** per usare articoli di prova senza registrar chiavi dei provider news.

5. Dalla cartella **`server/`**:
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev
   npm run dev
   ```
   Il server espone **`GET /health`** su **http://localhost:4000** di default (`PORT` in `.env` se diversa).

6. In un **secondo terminale**, dalla cartella **`web/`**:
   ```bash
   npm install
   npm run dev
   ```
   Imposta **`web/.env.local`** con **`NEXT_PUBLIC_API_URL=http://localhost:4000`** (stessa porta dell’API, senza slash finale).

7. Nel browser apri **http://localhost:3000** (il backend del passo 5 deve essere ancora attivo).

Non committare mai **`.env`** né **`web/.env.local`**: contengono segreti o URL personali.

### Database (Supabase / Prisma)

- **Prisma** usa PostgreSQL; lo schema vive in `server/prisma/schema.prisma` ([Database connection](https://www.prisma.io/docs/orm/reference/connection-urls)).
- **`DATABASE_URL`** — stringa usata da **Prisma Client** a runtime. Su hosting cloud conviene un pool di connessioni (meno connessioni verso il DB).
- **`DIRECT_URL`** — stringa per **migrazioni** (`prisma migrate`) e strumenti che richiedono una connessione **diretta** al nodo PostgreSQL, senza *transaction pooling* PgBouncer in mezzo. [Prisma + Supabase](https://www.prisma.io/docs/orm/overview/databases/supabase) e [pooled connection](https://www.prisma.io/docs/orm/prisma-client/setup/databases/postgresql#connection-pooler) spiegano il motivo: le migrate non vanno in genere al pooler in *transaction mode*.

**Supabase (tipico):**

- In dashboard: **Settings → Database** — trovi l’URL verso il **pooler** (spesso **porta 6543**, *Transaction mode* / PgBouncer) e l’URL **diretto** (host `db.…` o simile, **porta 5432**). Imposta:
  - `DATABASE_URL` = URL **pooled** (adatto all’app Node che apre/chiude molte query).
  - `DIRECT_URL` = URL **diretto** (per `prisma migrate dev` / `prisma migrate deploy`).
- Parametri come `?pgbouncer=true` e `connection_limit=1` dipendono dalla modalità; seguire la stringa proposta da Supabase [Connect to your project](https://supabase.com/docs/guides/database/connecting-to-postgres).

**Sviluppo locale (Postgres su Macchina o container):** di solito non c’è PgBouncer. Metti la **stessa** connection string in `DATABASE_URL` e `DIRECT_URL`.

Se in passato avevi solo `DATABASE_URL`, dopo l’aggiornamento a `directUrl` in schema aggiungi in `server/.env` una riga `DIRECT_URL=…` (in locale, copia il valore di `DATABASE_URL`).

**Migrazioni Prisma — `migrate dev` vs `migrate deploy`**

| Ambiente | Comando (da `server/`) | Cosa fa |
|----------|------------------------|---------|
| **Locale / sviluppo** | `npx prisma migrate dev` | Confronta lo schema con il DB, **applica** le migrazioni in `prisma/migrations/`, e se lo schema è cambiato rispetto all’ultima migrazione ne **crea** una nuova. Adatto quando modifichi `schema.prisma`. |
| **Produzione / CI** | `npx prisma migrate deploy` | Applica in ordine le migrazioni **già committate**; **non** genera file nuovi. Da eseguire prima del `npm run start` (es. step di build su hosting). Usa le variabili `DATABASE_URL` e `DIRECT_URL` con accesso reale al Postgres. [Workflow produzione (Prisma)](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production) |

- La cartella `server/prisma/migrations/` (SQL + `migration_lock.toml`) va **versionata in git**; ogni membro o la pipeline usano la stessa storia.
- In sviluppo, dopo `git pull` con nuove migrazioni, rieseguire `npx prisma migrate dev` (o `deploy` su un DB di staging) aggiorna lo schema senza riscriverlo a mano.

I dettagli delle variabili d’ambiente sono anche in `server/.env.example` e `web/.env.example` (nomi e placeholder, senza segreti). Copiali e rinomina in `.env` / `.env.local` come sotto.

## Avvio in locale

### 1. Clona e installa

```bash
cd server && npm install
cd ../web && npm install
```

### 2. Variabili d’ambiente

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env.local
```

Modifica almeno:

- **`server/.env` — `DATABASE_URL` e `DIRECT_URL`**: vedi sezione *Database (Supabase / Prisma)* sopra. In breve, entrambe obbligatorie; in locale possono coincidere.
- **`web/.env.local` — `NEXT_PUBLIC_API_URL`**: base URL del backend, **senza** slash finale (es. `http://localhost:4000` se l’API gira sulla porta 4000).

Con il front su **http://localhost:3000** il server **accetta già quell’origine** anche senza `CORS_ORIGIN`; imposta **`CORS_ORIGIN`** nel server solo se Next gira su **un’altra porta o host**.

### 3. Database e server API

```bash
cd server
npx prisma generate
npx prisma migrate dev
npm run dev
```

L’API ascolta su **`PORT`** (default **4000**). Stato: `GET /health` → `{"ok":true}`.

### 4. Frontend

In un altro terminale:

```bash
cd web
npm run dev
```

L’app Next.js è in genere su **http://localhost:3000** (porta predefinita di `next dev`).

Apri il browser su quell’URL: le richieste al backend usano `NEXT_PUBLIC_API_URL`.

## Variabili (riepilogo)

Le liste complete e i commenti sono in **`server/.env.example`** e **`web/.env.example`**. Riepilogo:

| Ambito | Variabile | Ruolo |
|--------|-----------|--------|
| Server | `PORT` | Porta HTTP (default 4000) |
| Server | `CORS_ORIGIN` | Origini CORS, separate da virgola |
| Server | `DATABASE_URL` | PostgreSQL: connessione a runtime (pooler in cloud se opportuno) |
| Server | `DIRECT_URL` | Stessa DB, connessione diretta per `prisma migrate` (spesso = `DATABASE_URL` in locale) |
| Server | `OPENAI_API_KEY` | Selettore a rilevanza (LLM) e sintesi; opzionale in dev (comportamento degradato) |
| Server | `NEWSDATA_API_KEY`, `THENEWS_API_KEY`, `GNEWS_API_KEY` | Provider notizie; vengono usati in ordine se configurati |
| Server | `NEWS_*`, `USE_MOCK_NEWS`, `NEWS_TRACE` | Opzionali: vedi `server/.env.example` |
| Web | `NEXT_PUBLIC_API_URL` | Base URL API per Axios |
| Web | `NEXT_PUBLIC_SITE_URL` | Opzionale: URL assoluto del sito (Open Graph / `metadataBase` in produzione) |

**Produzione tipica:** front su Vercel con `NEXT_PUBLIC_API_URL` verso l’URL HTTPS dell’API; API su un host (es. Render) con `CORS_ORIGIN` = origine del front (niente `wildcard` aperto in produzione).

## Fonti notizie

Il backend interroga i provider in **cascata**: con `NEWS_PROVIDER_ORDER` non impostato l’ordine predefinito è quello definito in `server/src/news/constants.ts` — `newsdata` → `thenewsapi` → `gnews`. Per ogni provider serve la rispettiva chiave in `server/.env` (`NEWSDATA_API_KEY`, `THENEWS_API_KEY`, `GNEWS_API_KEY`); i provider senza chiave vengono saltati. Con `USE_MOCK_NEWS=true` si possono usare dati di prova senza chiamate esterne.

### Provider in uso (ordine di default)

| ID in codice | Servizio | Documentazione | Termini / prezzi | Note sul piano gratuito (indicative — verificare sempre sul sito) |
|--------------|----------|----------------|------------------|-------------------------------------------------------------------|
| `newsdata` | [NewsData.io](https://newsdata.io/) | [Documentazione API](https://newsdata.io/documentation) | [Terms](https://newsdata.io/terms) · [Pricing](https://newsdata.io/pricing) | Piano free con crediti giornalieri e limiti su ritardi / lunghezza ricerca; dettagli aggiornati in pagina prezzi. |
| `thenewsapi` | [The News API](https://www.thenewsapi.com/) | [Documentazione](https://www.thenewsapi.com/documentation) | [Terms of Service](https://www.thenewsapi.com/tos) · [Pricing](https://www.thenewsapi.com/pricing) | Piano free con limite giornaliero di richieste e articoli per richiesta; vedi tabella sul sito. |
| `gnews` | [GNews API](https://gnews.io/) | [Documentazione](https://docs.gnews.io/) | [Terms of Service](https://gnews.io/legal/terms-of-service) · [Pricing](https://gnews.io/pricing) | Piano free per sviluppo/test; uso commerciale di produzione in genere richiede piano a pagamento (FAQ sul sito). |

### Attribuzione in Tongue

- In interfaccia, le **fonti** mostrate sotto le risposte dell’assistente derivano da `metadata.articles`: per ciascun articolo compaiono **titolo**, **URL** e **testata** (`source` o provider), in linea con i dati restituiti dagli API e persistiti dal server.
- I contenuti editoriali appartengono alle **testate e ai siti di origine**; Tongue propone una sintesi e un collegamento, senza sostituire l’editore originale.
- L’osservanza dei **termini d’uso** e delle **licenze** di ciascun provider e dei singoli siti notizia è a carico di chi distribuisce il prodotto; consultare le pagine ufficiali collegate nella tabella.

## Script utili

| Comando (da `server/`) | Effetto |
|------------------------|---------|
| `npm run dev` | `tsx watch` sul server |
| `npm run build` | Compila TypeScript in `dist/` |
| `npm run start` | Avvia `node dist/index.js` |
| `npx prisma migrate dev` | Migrazioni in sviluppo |
| `npx prisma migrate deploy` | Migrazioni in produzione |
| `npm test` | Test contratto metadata (se presente) |

| Comando (da `web/`) | Effetto |
|---------------------|---------|
| `npm run dev` | Next.js in dev |
| `npm run build` | Build di produzione |
| `npm run start` | Avvio dopo build |

## License

Vedi [LICENSE](LICENSE) se presente.
