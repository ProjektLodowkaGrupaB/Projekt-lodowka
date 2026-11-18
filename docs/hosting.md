# Hosting aplikacji (SCRUM-64)

Stan na 18 listopada 2026. Limity darmowych planów mogą się zmienić, więc przed wdrożeniem warto je sprawdzić w podlinkowanych źródłach.

## Decyzja

| Część | Usługa | Plan |
|---|---|---|
| Frontend (`client/`) | Netlify | Free |
| API (`server/`) | Render, Web Service | Free |
| Baza danych | Supabase, PostgreSQL | Free |

Express działa na Renderze bez zmian w kodzie. Netlify zostaje przy samym frontendzie, a baza pozostaje w istniejącym projekcie Supabase.

## Porównanie opcji dla API

| Opcja | Plusy | Minusy | Wynik |
|---|---|---|---|
| **Render Free** | zwykły serwer Node.js, wdrożenie z GitHuba, brak zmian w kodzie | usypianie po 15 minutach bez ruchu i start trwający około minuty; 750 godzin miesięcznie na workspace | **wybrane** |
| Netlify Functions | jeden dostawca dla frontendu i API | trzeba przerobić Express na funkcje; każda instancja funkcji otwiera własne połączenia z bazą; plan Free ma twardy limit 300 kredytów miesięcznie | odrzucone |
| Railway | prosta konfiguracja | jednorazowe 5 USD na 30 dni, potem plan Free z 1 USD miesięcznie albo Hobby za 5 USD miesięcznie | odrzucone |

Jedna usługa działająca cały miesiąc mieści się w 750 godzinach. Przed prezentacją trzeba otworzyć aplikację 1–2 minuty wcześniej, żeby API zdążyło się wybudzić.

## Konfiguracja

### Render

- Root Directory: `server`
- Build Command: `npm ci`
- Start Command: `npm start`
- Zmienne środowiskowe:

| Zmienna | Wartość |
|---|---|
| `DB_HOST` | `aws-1-eu-west-1.pooler.supabase.com` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `postgres` |
| `DB_USER` | `postgres.sbpwsvwzamlzklszoiml` |
| `DB_PASSWORD` | hasło bazy, wpisane tylko w panelu Rendera |
| `DB_SSL` | `true` |
| `CLIENT_URL` | adres strony z Netlify, bez końcowego `/` |

Używamy Session poolera Supabase, bo bezpośrednie połączenie z bazą domyślnie działa przez IPv6.

### Netlify

- Base directory: `client`
- Build command: `npm run build`
- Publish directory: `dist`
- Zmienna `VITE_API_URL`: adres usługi z Rendera z końcówką `/api`
- Przekierowanie dla adresów aplikacji (np. `/przepisy/5`): plik `client/public/_redirects` z wierszem `/* /index.html 200`

## Źródła

- [Render: FAQ i usypianie darmowych usług](https://render.com/docs/faq)
- [Render: hosting Node.js i limit godzin](https://render.com/hosting/nodejs)
- [Railway: plany i ceny](https://docs.railway.com/pricing/plans)
- [Netlify: plany oparte na kredytach](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- [Netlify: konfiguracja funkcji](https://docs.netlify.com/build/functions/configuration/)
