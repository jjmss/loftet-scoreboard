# Loftet

Mobilvennlig poengtavle og loddtrekning for fellesoppgaver på Fruktsalat-loftet.

Folk registrerer seg med navn (lagret i cookie), logger gjøremål og får **lodd**. På fredagsmøtet merker dere hvem som er til stede og spinner hjulet — bare de som er der kan vinne. Oppdateringer går live over WebSocket.

Produksjon: [loftet.fruktsalat.no](https://loftet.fruktsalat.no)

## Stack

- Vite + React (mobil-først UI, norsk)
- Node 22 + Hono + WebSocket
- SQLite (`node:sqlite`) på disk / Docker-volume
- Ett image som serverer API, WebSocket og ferdigbygget frontend

## Lokalt

Krever **Node 22+**.

```bash
cp .env.example .env
npm install
npm run dev
```

- Web: [http://localhost:5173](http://localhost:5173)
- API / WS: [http://localhost:3000](http://localhost:3000)

Vite proxier `/api` og `/ws` til backend, så cookien og live-oppdateringer virker på 5173.

```bash
npm test          # backend-tester (cookie, lodd, WS, fredagsspinn)
npm run build
npm start         # serverer API + frontend/dist på PORT (default 3000)
```

SQLite-filen lander i `data/loftet.db` (eller `DATABASE_PATH`).

## Docker (Dokploy / Hetzner)

Image-et lytter på `PORT` (default 3000) og lagrer databasen på `/data`.

```bash
docker compose up --build
```

Åpne [http://localhost:3000](http://localhost:3000). Volume `loftet-data` bevarer lodd og vinnere mellom restart.

På Dokploy: bygg fra Dockerfile, sett `PORT` til den porten plattformen forventer, mount et volume på `/data`, og sett `COOKIE_SECURE=true` bak HTTPS.

| Variabel | Default | Betydning |
| --- | --- | --- |
| `PORT` | `3000` | Port prosessen lytter på |
| `DATABASE_PATH` | `./data/loftet.db` | SQLite-fil |
| `COOKIE_SECURE` | auto (`true` hvis `x-forwarded-proto=https`) | Secure-flagg på navne-cookien |
| `FRONTEND_DIST` | auto | Mappe med `index.html` (settes i Docker) |

Ingen OAuth i v1 — identitet er en httpOnly-cookie (`loftet_uid`) med brukerens id.

## Faste oppgaver

- Ta ut av oppvaskmaskinen
- Sett inn i oppvaskmaskinen
- Vanne planter
- Fylle/fikse kaffemaskina
- Rydde

Hver loggføring = 1 lodd. Tavla rangeres etter antall lodd.
