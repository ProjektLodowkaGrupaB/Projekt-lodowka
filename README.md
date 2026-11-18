# SmartPantry

Aplikacja do zarządzania domową spiżarnią, wyposażeniem kuchni i przepisami. Podpowiada, co można ugotować z posiadanych produktów i sprawnego sprzętu.

## Struktura repozytorium

| Katalog | Zawartość |
|---|---|
| `client/` | frontend: React, TypeScript, Vite, Tailwind CSS |
| `server/` | API: Node.js, Express, PostgreSQL |
| `db/` | schemat bazy (`schema.sql`) |
| `docs/` | decyzje i dokumentacja projektu |

## Uruchomienie lokalne

Wymagany jest Node.js 20 lub nowszy oraz dostęp do bazy PostgreSQL (w projekcie: Supabase).

**API**

```bash
cd server
npm install
cp .env.example .env   # uzupełnij DB_PASSWORD
npm run dev
```

API działa pod `http://localhost:3000/api`.

**Frontend** (w drugim terminalu)

```bash
cd client
npm install
npm run dev
```

Aplikacja działa pod `http://localhost:5173`. Inny adres API ustawisz w `client/.env` przez `VITE_API_URL`.

Pliku `.env` nie commitujemy.

## Testy i kontrola kodu

```bash
cd server && npm test
cd client && npm run lint && npm run build
```

## API

Nazwy pól w API i we frontendzie są takie same jak kolumny w bazie.

| Zasób | Operacje |
|---|---|
| `/api/spizarnia` | `GET`, `POST`, `PUT /:id`, `DELETE /:id` |
| `/api/skladniki` | `GET` |
| `/api/sprzet` | `GET`, `POST`, `PUT /:id`, `PATCH /:id/status`, `DELETE /:id` |
| `/api/przepisy` | `GET` (także `?ulubione=true`), `POST`, `GET /dopasowane`, `GET /:id`, `PUT /:id`, `DELETE /:id` |
| `/api/przepisy/:id/ulubione` | `PATCH` |
| `/api/przepisy/:id/ugotuj` | `POST` |

## Zasady pracy

1. Zadanie bierzemy z Jiry (projekt `SCRUM`).
2. Branch tworzymy od `main` i nazywamy `SCRUM-123-krotki-opis`.
3. Commit zaczynamy numerem zadania, np. `SCRUM-123 Dodanie filtrów`.
4. Zmiany wchodzą do `main` wyłącznie przez Pull Request z akceptacją innej osoby z zespołu.
5. Po scaleniu przenosimy zadanie w Jirze na „Gotowe”.

Wdrożenie opisuje [docs/hosting.md](docs/hosting.md).
