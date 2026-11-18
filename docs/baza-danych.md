# Baza danych

Aplikacja korzysta z PostgreSQL w Supabase. Pełny schemat jest w [`db/schema.sql`](../db/schema.sql), a dane startowe w [`db/seed.sql`](../db/seed.sql).

## Diagram ERD

```mermaid
erDiagram
    skladniki ||--o{ spizarnia : "jest w"
    skladniki ||--o{ przepis_skladniki : "występuje w"
    przepisy ||--o{ przepis_skladniki : "zawiera"
    przepisy }o..o{ sprzet : "wymaga (tablice id)"

    skladniki {
        serial id PK
        varchar nazwa UK "wymagana, do 100 znaków"
        unit_meas_enum domyslna_jednostka
    }
    spizarnia {
        serial id PK
        integer skladnik_id FK "wymagany"
        varchar opis
        numeric qty "10,2"
        unit_meas_enum unit_meas
        date expire_date
        integer kalorie "kcal na 100 g"
    }
    przepisy {
        serial id PK
        varchar nazwa
        integer czas "minuty"
        difficulty_enum trudnosc
        integer kalorycznosc "kcal na porcję"
        integer porcja
        integer_array sprzet
        integer_array sprzet_alternatywny
        text opis
        boolean ulubione
        jsonb diety
        jsonb alergeny
    }
    przepis_skladniki {
        serial id PK
        integer przepis_id FK
        integer skladnik_id FK
        numeric qty "wymagana"
        unit_meas_enum unit_meas "wymagana"
    }
    sprzet {
        serial id PK
        varchar nazwa
        boolean sprawny
        varchar kategoria
        varchar status_opis
        text notatki
    }
```

## Tabele

| Tabela | Przeznaczenie |
|---|---|
| `skladniki` | Słownik składników. Nazwa jest unikalna. |
| `spizarnia` | Produkty posiadane przez użytkownika: ilość, jednostka, data ważności, kalorie. |
| `sprzet` | Wyposażenie kuchni. `sprawny` decyduje o dopasowaniu przepisów, a `status_opis` podaje stan: gotowy, w naprawie lub niedostępny. |
| `przepisy` | Przepisy: czas, trudność, kaloryczność porcji, liczba porcji, opis, ulubione, diety i alergeny. |
| `przepis_skladniki` | Składniki przepisu z ilością i jednostką. |

## Relacje

| Relacja | Usuwanie |
|---|---|
| `spizarnia.skladnik_id` → `skladniki.id` | Składnika używanego w spiżarni nie można usunąć (`RESTRICT`). |
| `przepis_skladniki.skladnik_id` → `skladniki.id` | Składnika używanego w przepisie nie można usunąć (`RESTRICT`). |
| `przepis_skladniki.przepis_id` → `przepisy.id` | Usunięcie przepisu usuwa jego składniki (`CASCADE`). |

`przepisy.sprzet` i `przepisy.sprzet_alternatywny` to tablice identyfikatorów bez klucza obcego, dlatego na diagramie relacja jest przerywana. Usuwanie sprzętu czyści te tablice w API. Zamianę na tabelę łączącą opisuje SCRUM-82.

## Typy

| Typ | Wartości |
|---|---|
| `unit_meas_enum` | `kg`, `g`, `l`, `ml`, `szt`, `opak.`, `opak` |
| `difficulty_enum` | `łatwy`, `średni`, `trudny` |

## Widoki

| Widok | Zawartość |
|---|---|
| `widok_przepisy_szczegoly` | Przepis z listą składników w jednym polu tekstowym. |
| `widok_przepisy_kompletnosc` | Przepisy, dla których spiżarnia zawiera ponad 70% składników. Widok liczy same pozycje, bez porównywania ilości. |
