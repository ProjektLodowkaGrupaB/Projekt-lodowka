-- Schemat bazy SmartPantry (PostgreSQL / Supabase), stan z 2026-11-18.
-- Odtworzenie na czystej bazie: psql "$DATABASE_URL" -f db/schema.sql

CREATE TYPE unit_meas_enum AS ENUM ('kg', 'g', 'l', 'szt', 'opak.', 'ml', 'opak');
CREATE TYPE difficulty_enum AS ENUM ('łatwy', 'średni', 'trudny');

CREATE TABLE skladniki (
    id SERIAL PRIMARY KEY,
    nazwa character varying(100) NOT NULL UNIQUE,
    domyslna_jednostka unit_meas_enum
);

CREATE TABLE sprzet (
    id SERIAL PRIMARY KEY,
    nazwa character varying(1000),
    sprawny boolean,
    kategoria character varying DEFAULT 'AGD małe',
    status_opis character varying DEFAULT 'gotowy',
    notatki text DEFAULT ''
);

CREATE TABLE przepisy (
    id SERIAL PRIMARY KEY,
    nazwa character varying(100),
    czas integer,
    trudnosc difficulty_enum,
    kalorycznosc integer,
    porcja integer,
    sprzet integer[],
    sprzet_alternatywny integer[],
    opis text,
    ulubione boolean NOT NULL DEFAULT false,
    diety jsonb NOT NULL DEFAULT '[]'::jsonb,
    alergeny jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE spizarnia (
    id SERIAL PRIMARY KEY,
    skladnik_id integer NOT NULL REFERENCES skladniki(id) ON DELETE RESTRICT,
    opis character varying(1000),
    qty numeric(10,2),
    unit_meas unit_meas_enum,
    expire_date date,
    kalorie integer
);

CREATE TABLE przepis_skladniki (
    id SERIAL PRIMARY KEY,
    przepis_id integer REFERENCES przepisy(id) ON DELETE CASCADE,
    skladnik_id integer REFERENCES skladniki(id) ON DELETE RESTRICT,
    qty numeric(10,2) NOT NULL,
    unit_meas unit_meas_enum NOT NULL
);

CREATE OR REPLACE VIEW widok_przepisy_szczegoly AS
SELECT
    p.id AS przepis_id,
    p.nazwa AS przepis_nazwa,
    p.czas,
    p.trudnosc,
    p.kalorycznosc,
    p.porcja,
    p.opis,
    string_agg(ps.qty || ' ' || ps.unit_meas || ' ' || sk.nazwa, ', ') AS skladniki_lista
FROM przepisy p
LEFT JOIN przepis_skladniki ps ON p.id = ps.przepis_id
LEFT JOIN skladniki sk ON ps.skladnik_id = sk.id
GROUP BY p.id, p.nazwa, p.czas, p.trudnosc, p.kalorycznosc, p.porcja, p.opis;

CREATE OR REPLACE VIEW widok_przepisy_kompletnosc AS
SELECT
    p.id AS przepis_id,
    p.nazwa AS przepis_nazwa,
    p.czas,
    p.trudnosc,
    COUNT(ps.id) AS wymagane_skladniki_liczba,
    COUNT(s.id) AS posiadane_skladniki_liczba,
    ROUND((COUNT(s.id)::numeric / NULLIF(COUNT(ps.id), 0)) * 100, 1) AS procent_kompletnosci
FROM przepisy p
JOIN przepis_skladniki ps ON p.id = ps.przepis_id
LEFT JOIN spizarnia s ON s.skladnik_id = ps.skladnik_id AND s.qty > 0
GROUP BY p.id, p.nazwa, p.czas, p.trudnosc
HAVING (COUNT(s.id)::numeric / NULLIF(COUNT(ps.id), 0)) * 100 > 70;

-- Dostęp w Supabase: RLS włączone, a reguły celowo otwarte, bo korzysta z nich zespół.
-- Przed oddaniem projektu trzeba je zawęzić (każdy z kluczem publicznym może zmieniać dane).
ALTER TABLE skladniki ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprzet ENABLE ROW LEVEL SECURITY;
ALTER TABLE przepisy ENABLE ROW LEVEL SECURITY;
ALTER TABLE spizarnia ENABLE ROW LEVEL SECURITY;
ALTER TABLE przepis_skladniki ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publiczny dostep skladniki" ON skladniki FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Publiczny dostep sprzet" ON sprzet FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Publiczny dostep przepisy" ON przepisy FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Publiczny dostep spizarnia" ON spizarnia FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Publiczny dostep przepis_skladniki" ON przepis_skladniki FOR ALL USING (true) WITH CHECK (true);
