-- Dane startowe SmartPantry (SCRUM-13): 35 składników, 15 sprzętów, 20 przepisów, 33 produktów w spiżarni.
-- Uruchomienie po db/schema.sql: psql "$DATABASE_URL" -f db/seed.sql
-- Skrypt można uruchamiać wielokrotnie: istniejące wpisy o tych samych nazwach zostają bez zmian.
-- Daty ważności są liczone od dnia uruchomienia, więc pokaz zawsze ma produkty świeże, z krótką datą i po terminie.

BEGIN;

INSERT INTO skladniki (nazwa, domyslna_jednostka)
VALUES
    ('Makaron Penne', 'g'::unit_meas_enum),
    ('Szpinak świeży', 'g'::unit_meas_enum),
    ('Suszone pomidory', 'g'::unit_meas_enum),
    ('Śmietanka 30%', 'ml'::unit_meas_enum),
    ('Pierś z kurczaka', 'g'::unit_meas_enum),
    ('Jajka wiejskie', 'szt'::unit_meas_enum),
    ('Czosnek', 'szt'::unit_meas_enum),
    ('Mleko 3.2%', 'l'::unit_meas_enum),
    ('Ryż jaśminowy', 'g'::unit_meas_enum),
    ('Łosoś świeży filet', 'g'::unit_meas_enum),
    ('Brokuł świeży', 'g'::unit_meas_enum),
    ('Oliwa z oliwek Extra Virgin', 'g'::unit_meas_enum),
    ('Cytryna', 'szt'::unit_meas_enum),
    ('Płatki owsiane górskie', 'g'::unit_meas_enum),
    ('Banan', 'szt'::unit_meas_enum),
    ('Miód pszczeli wielokwiatowy', 'g'::unit_meas_enum),
    ('Masło orzechowe 100%', 'g'::unit_meas_enum),
    ('Jogurt grecki', 'g'::unit_meas_enum),
    ('Mięso mielone wołowe', 'g'::unit_meas_enum),
    ('Pomidory pelati w puszce', 'g'::unit_meas_enum),
    ('Fasola czerwona konserwowa', 'g'::unit_meas_enum),
    ('Kukurydza konserwowa', 'g'::unit_meas_enum),
    ('Papryka czerwona', 'g'::unit_meas_enum),
    ('Cebula żółta', 'szt'::unit_meas_enum),
    ('Tortilla pszenna pełnoziarnista', 'szt'::unit_meas_enum),
    ('Ser Cheddar tarty', 'g'::unit_meas_enum),
    ('Ser Mozzarella kulka', 'g'::unit_meas_enum),
    ('Ziemniaki młode', 'g'::unit_meas_enum),
    ('Marchew', 'g'::unit_meas_enum),
    ('Soczewica czerwona sucha', 'g'::unit_meas_enum),
    ('Mleczko kokosowe', 'g'::unit_meas_enum),
    ('Twaróg półtłusty', 'g'::unit_meas_enum),
    ('Awokado Hass', 'szt'::unit_meas_enum),
    ('Masło ekstra 82%', 'g'::unit_meas_enum),
    ('Cukier trzcinowy nierafinowany', 'kg'::unit_meas_enum)
ON CONFLICT (nazwa) DO NOTHING;

INSERT INTO sprzet (nazwa, sprawny, kategoria, status_opis, notatki)
SELECT v.nazwa, v.sprawny, v.kategoria, v.status_opis, ''
FROM (VALUES
    ('Patelnia żeliwna', true, 'Garnki i patelnie', 'gotowy'),
    ('Garnek stalowy 4L', true, 'Garnki i patelnie', 'gotowy'),
    ('Piekarnik elektryczny', true, 'AGD duże', 'gotowy'),
    ('Blender kielichowy', false, 'AGD małe', 'w naprawie'),
    ('Wok stalowy 32cm', true, 'Garnki i patelnie', 'gotowy'),
    ('Air Fryer (Frytkownica beztłuszczowa)', true, 'AGD małe', 'gotowy'),
    ('Naczynie żaroodporne', false, 'Naczynia do pieczenia', 'niedostępny'),
    ('Wolnowar (Slow Cooker)', false, 'AGD małe', 'niedostępny'),
    ('Mikser planetarny', true, 'AGD małe', 'gotowy'),
    ('Malakser kuchenny', false, 'AGD małe', 'niedostępny'),
    ('Grill elektryczny', false, 'AGD małe', 'niedostępny'),
    ('Czajnik elektryczny', true, 'AGD małe', 'gotowy'),
    ('Toster', true, 'AGD małe', 'gotowy'),
    ('Deska i noże kuchenne', true, 'Akcesoria kuchenne', 'gotowy'),
    ('Forma do pieczenia', true, 'Naczynia do pieczenia', 'gotowy')
) AS v(nazwa, sprawny, kategoria, status_opis)
WHERE NOT EXISTS (SELECT 1 FROM sprzet s WHERE s.nazwa = v.nazwa);

INSERT INTO przepisy (nazwa, czas, trudnosc, kalorycznosc, porcja, sprzet, sprzet_alternatywny, opis, diety, alergeny)
SELECT
    v.nazwa, v.czas, v.trudnosc::difficulty_enum, v.kalorycznosc, v.porcja,
    ARRAY(SELECT s.id FROM unnest(v.sprzet) WITH ORDINALITY AS u(nazwa, nr) JOIN sprzet s ON s.nazwa = u.nazwa ORDER BY u.nr),
    ARRAY(SELECT s.id FROM unnest(v.alternatywny) WITH ORDINALITY AS u(nazwa, nr) JOIN sprzet s ON s.nazwa = u.nazwa ORDER BY u.nr),
    v.opis, v.diety, v.alergeny
FROM (VALUES
    ('Makaron penne ze szpinakiem i suszonymi pomidorami', 20, 'łatwy', 540, 2, ARRAY['Garnek stalowy 4L', 'Patelnia żeliwna']::text[], ARRAY[]::text[],
     'Ugotuj makaron al dente w osolonej wodzie.
Na patelni podsmaż czosnek i pokrojone suszone pomidory.
Dodaj świeży szpinak oraz śmietankę 30%, duś przez 3 minuty i wymieszaj z makaronem.',
     '["Bezmięsne (Wege)"]'::jsonb, '["Gluten","Laktoza"]'::jsonb),
    ('Kurczak w sosie śmietanowo-szpinakowym', 30, 'łatwy', 480, 2, ARRAY['Patelnia żeliwna']::text[], ARRAY['Piekarnik elektryczny']::text[],
     'Pokrój pierś z kurczaka w kostkę i podsmaż na patelni.
Dodaj suszone pomidory oraz śmietankę 30%.
Wrzuć szpinak i duś pod przykryciem przez 5 minut.',
     '["Bez glutenu"]'::jsonb, '["Laktoza"]'::jsonb),
    ('Jajecznica na parze ze szpinakiem i czosnkiem', 15, 'łatwy', 310, 2, ARRAY['Patelnia żeliwna']::text[], ARRAY[]::text[],
     'Podsmaż posiekany czosnek i liście szpinaku na patelni.
Wbij jajka wiejskie i mieszaj na małym ogniu do ścięcia.',
     '["Bezmięsne (Wege)","Bez glutenu","Keto"]'::jsonb, '["Jajka"]'::jsonb),
    ('Pieczony łosoś z Air Fryera z brokułem i ryżem jaśminowym', 22, 'łatwy', 610, 2, ARRAY['Air Fryer (Frytkownica beztłuszczowa)']::text[], ARRAY['Naczynie żaroodporne']::text[],
     'Ugotuj ryż jaśminowy w lekko osolonej wodzie.
Filet z łososia skrop sokiem z cytryny oraz oliwą z oliwek.
Włóż łososia i różyczki brokuła do Air Fryera na 14 minut w 190°C.
Podawaj gorącego łososia na ryżu z cząstką cytryny.',
     '["Bez glutenu","Bez laktozy"]'::jsonb, '[]'::jsonb),
    ('Kremowa owsianka mocy z bananem, miodem i masłem orzechowym', 10, 'łatwy', 490, 1, ARRAY[]::text[], ARRAY[]::text[],
     'Zalej płatki owsiane gorącą wodą lub mlekiem i gotuj 5 minut na małym ogniu.
Wymieszaj z jogurtem greckim oraz łyżką miodu.
Na wierzchu ułóż plastry banana i dodaj masło orzechowe.',
     '["Bezmięsne (Wege)"]'::jsonb, '["Gluten","Laktoza","Orzechy"]'::jsonb),
    ('Meksykańskie Chili con Carne z wołowiną i fasolą', 45, 'średni', 580, 4, ARRAY['Wok stalowy 32cm']::text[], ARRAY['Wolnowar (Slow Cooker)']::text[],
     'Podsmaż posiekaną cebulę i mięso mielone wołowe w rozgrzanym woku.
Dodaj pokrojoną czerwoną paprykę, pomidory pelati, czerwoną fasolę oraz kukurydzę.
Duś pod przykryciem przez 30 minut, aż sos zgęstnieje. Podawaj z ryżem.',
     '["Bez glutenu","Bez laktozy"]'::jsonb, '[]'::jsonb),
    ('Aromatyczny indyjski Dhal z czerwonej soczewicy i mleczka kokosowego', 25, 'łatwy', 440, 3, ARRAY['Wok stalowy 32cm']::text[], ARRAY[]::text[],
     'Zeszklij cebulę na oliwie w głębokim woku.
Wsyp przepłukaną czerwoną soczewicę, dodaj pomidory pelati oraz mleczko kokosowe.
Gotuj na wolnym ogniu przez 18 minut do miękkości soczewicy.',
     '["Wegańskie","Bezmięsne (Wege)","Bez glutenu","Bez laktozy"]'::jsonb, '[]'::jsonb),
    ('Quesadilla z ciągnącym cheddarem, kukurydzą i świeżym awokado', 15, 'łatwy', 520, 2, ARRAY['Wok stalowy 32cm']::text[], ARRAY['Air Fryer (Frytkownica beztłuszczowa)']::text[],
     'Na placku tortilli ułóż tarty ser cheddar, kukurydzę, pokrojoną paprykę i plastry awokado.
Złóż tortillę na pół i opiekaj z obu stron na suchej powierzchni do rozpuszczenia sera.',
     '["Bezmięsne (Wege)"]'::jsonb, '["Gluten","Laktoza"]'::jsonb),
    ('Puszyste placuszki twarogowo-bananowe z płatkami owsianymi', 20, 'średni', 410, 2, ARRAY['Mikser planetarny']::text[], ARRAY[]::text[],
     'Wymieszaj twaróg półtłusty z rozgniecionym bananem, płatkami owsianymi i miodem.
Uformuj niewielkie placuszki i smaż na złoty kolor.',
     '["Bezmięsne (Wege)"]'::jsonb, '["Gluten","Laktoza"]'::jsonb),
    ('Złociste ziemniaki i marchewki pieczone z masłem i oliwą', 35, 'łatwy', 360, 3, ARRAY['Naczynie żaroodporne']::text[], ARRAY['Air Fryer (Frytkownica beztłuszczowa)']::text[],
     'Pokrój młode ziemniaki oraz marchew w słupki.
Wymieszaj w naczyniu żaroodpornym z oliwą i odrobiną masła.
Piecz 30 minut w 200°C do chrupkości.',
     '["Bezmięsne (Wege)","Bez glutenu"]'::jsonb, '["Laktoza"]'::jsonb),
    ('Zapiekanka ziemniaczana Gratin z mozzarellą i cheddarem', 50, 'trudny', 590, 4, ARRAY['Malakser kuchenny', 'Naczynie żaroodporne']::text[], ARRAY[]::text[],
     'Poszatkuj ziemniaki oraz cebulę w malakserze na cienkie talarki.
Ułóż warstwami w naczyniu żaroodpornym, posyp cheddarem i mozzarellą.
Zapiecz przez 40 minut do uzyskania złocistej skorupki.',
     '["Bezmięsne (Wege)","Bez glutenu"]'::jsonb, '["Laktoza"]'::jsonb),
    ('Kurczak curry z mleczkiem kokosowym i ryżem', 30, 'średni', 620, 2, ARRAY['Wok stalowy 32cm']::text[], ARRAY['Patelnia żeliwna']::text[],
     'Ugotuj ryż jaśminowy.
Podsmaż cebulę i pokrojoną pierś z kurczaka.
Dodaj paprykę oraz mleczko kokosowe i gotuj 10 minut.
Podawaj z ryżem.',
     '["Bez glutenu","Bez laktozy"]'::jsonb, '[]'::jsonb),
    ('Zupa pomidorowa z czosnkiem i śmietanką', 25, 'łatwy', 260, 2, ARRAY['Garnek stalowy 4L']::text[], ARRAY[]::text[],
     'Zeszklij cebulę i czosnek w garnku.
Dodaj pomidory pelati i gotuj 15 minut.
Zabiel śmietanką i dopraw.',
     '["Bezmięsne (Wege)","Bez glutenu"]'::jsonb, '["Laktoza"]'::jsonb),
    ('Omlet ze szpinakiem i cheddarem', 12, 'łatwy', 390, 1, ARRAY['Patelnia żeliwna']::text[], ARRAY[]::text[],
     'Roztrzep jajka.
Podsmaż szpinak na maśle.
Wlej jajka, posyp cheddarem i smaż pod przykryciem.',
     '["Bezmięsne (Wege)","Bez glutenu","Keto"]'::jsonb, '["Jajka","Laktoza"]'::jsonb),
    ('Sałatka z awokado, kukurydzą i papryką', 10, 'łatwy', 320, 2, ARRAY['Deska i noże kuchenne']::text[], ARRAY[]::text[],
     'Pokrój awokado i paprykę.
Dodaj kukurydzę.
Skrop oliwą i sokiem z cytryny, delikatnie wymieszaj.',
     '["Wegańskie","Bezmięsne (Wege)","Bez glutenu","Bez laktozy"]'::jsonb, '[]'::jsonb),
    ('Tortilla z kurczakiem i papryką', 20, 'łatwy', 510, 2, ARRAY['Patelnia żeliwna']::text[], ARRAY['Wok stalowy 32cm']::text[],
     'Usmaż pokrojonego kurczaka z papryką.
Nałóż farsz na tortille i posyp cheddarem.
Zwiń i krótko podgrzej.',
     '[]'::jsonb, '["Gluten","Laktoza"]'::jsonb),
    ('Jogurt grecki z bananem i miodem', 5, 'łatwy', 280, 1, ARRAY[]::text[], ARRAY[]::text[],
     'Pokrój banana.
Wymieszaj z jogurtem greckim.
Polej miodem.',
     '["Bezmięsne (Wege)","Bez glutenu"]'::jsonb, '["Laktoza"]'::jsonb),
    ('Krem z marchwi i czerwonej soczewicy', 30, 'łatwy', 340, 3, ARRAY['Garnek stalowy 4L']::text[], ARRAY[]::text[],
     'Podsmaż cebulę na oliwie.
Dodaj marchew, soczewicę i wodę.
Gotuj 20 minut i rozgnieć na gładko.',
     '["Wegańskie","Bezmięsne (Wege)","Bez glutenu","Bez laktozy"]'::jsonb, '[]'::jsonb),
    ('Ryż smażony z warzywami i jajkiem', 20, 'średni', 450, 2, ARRAY['Wok stalowy 32cm']::text[], ARRAY['Patelnia żeliwna']::text[],
     'Ugotuj i ostudź ryż.
Usmaż marchew i paprykę.
Dodaj ryż oraz roztrzepane jajka i smaż, mieszając.',
     '["Bezmięsne (Wege)","Bez glutenu","Bez laktozy"]'::jsonb, '["Jajka"]'::jsonb),
    ('Tortilla z awokado i jajkiem', 10, 'łatwy', 430, 1, ARRAY['Patelnia żeliwna']::text[], ARRAY[]::text[],
     'Usmaż jajko.
Rozgnieć awokado z sokiem z cytryny.
Posmaruj tortillę i ułóż jajko.',
     '["Bezmięsne (Wege)","Bez laktozy"]'::jsonb, '["Gluten","Jajka"]'::jsonb)
) AS v(nazwa, czas, trudnosc, kalorycznosc, porcja, sprzet, alternatywny, opis, diety, alergeny)
WHERE NOT EXISTS (SELECT 1 FROM przepisy p WHERE p.nazwa = v.nazwa);

INSERT INTO przepis_skladniki (przepis_id, skladnik_id, qty, unit_meas)
SELECT p.id, s.id, v.qty, v.unit_meas::unit_meas_enum
FROM (VALUES
    ('Makaron penne ze szpinakiem i suszonymi pomidorami', 'Makaron Penne', 200, 'g'),
    ('Makaron penne ze szpinakiem i suszonymi pomidorami', 'Szpinak świeży', 100, 'g'),
    ('Makaron penne ze szpinakiem i suszonymi pomidorami', 'Suszone pomidory', 60, 'g'),
    ('Makaron penne ze szpinakiem i suszonymi pomidorami', 'Śmietanka 30%', 150, 'ml'),
    ('Kurczak w sosie śmietanowo-szpinakowym', 'Pierś z kurczaka', 400, 'g'),
    ('Kurczak w sosie śmietanowo-szpinakowym', 'Śmietanka 30%', 150, 'ml'),
    ('Kurczak w sosie śmietanowo-szpinakowym', 'Suszone pomidory', 50, 'g'),
    ('Kurczak w sosie śmietanowo-szpinakowym', 'Szpinak świeży', 80, 'g'),
    ('Jajecznica na parze ze szpinakiem i czosnkiem', 'Jajka wiejskie', 4, 'szt'),
    ('Jajecznica na parze ze szpinakiem i czosnkiem', 'Szpinak świeży', 50, 'g'),
    ('Jajecznica na parze ze szpinakiem i czosnkiem', 'Czosnek', 1, 'szt'),
    ('Pieczony łosoś z Air Fryera z brokułem i ryżem jaśminowym', 'Łosoś świeży filet', 300, 'g'),
    ('Pieczony łosoś z Air Fryera z brokułem i ryżem jaśminowym', 'Ryż jaśminowy', 150, 'g'),
    ('Pieczony łosoś z Air Fryera z brokułem i ryżem jaśminowym', 'Brokuł świeży', 250, 'g'),
    ('Pieczony łosoś z Air Fryera z brokułem i ryżem jaśminowym', 'Oliwa z oliwek Extra Virgin', 20, 'g'),
    ('Pieczony łosoś z Air Fryera z brokułem i ryżem jaśminowym', 'Cytryna', 1, 'szt'),
    ('Kremowa owsianka mocy z bananem, miodem i masłem orzechowym', 'Płatki owsiane górskie', 80, 'g'),
    ('Kremowa owsianka mocy z bananem, miodem i masłem orzechowym', 'Banan', 1, 'szt'),
    ('Kremowa owsianka mocy z bananem, miodem i masłem orzechowym', 'Jogurt grecki', 100, 'g'),
    ('Kremowa owsianka mocy z bananem, miodem i masłem orzechowym', 'Miód pszczeli wielokwiatowy', 25, 'g'),
    ('Kremowa owsianka mocy z bananem, miodem i masłem orzechowym', 'Masło orzechowe 100%', 30, 'g'),
    ('Meksykańskie Chili con Carne z wołowiną i fasolą', 'Mięso mielone wołowe', 500, 'g'),
    ('Meksykańskie Chili con Carne z wołowiną i fasolą', 'Pomidory pelati w puszce', 400, 'g'),
    ('Meksykańskie Chili con Carne z wołowiną i fasolą', 'Fasola czerwona konserwowa', 200, 'g'),
    ('Meksykańskie Chili con Carne z wołowiną i fasolą', 'Kukurydza konserwowa', 150, 'g'),
    ('Meksykańskie Chili con Carne z wołowiną i fasolą', 'Papryka czerwona', 150, 'g'),
    ('Meksykańskie Chili con Carne z wołowiną i fasolą', 'Cebula żółta', 1, 'szt'),
    ('Meksykańskie Chili con Carne z wołowiną i fasolą', 'Ryż jaśminowy', 200, 'g'),
    ('Aromatyczny indyjski Dhal z czerwonej soczewicy i mleczka kokosowego', 'Soczewica czerwona sucha', 250, 'g'),
    ('Aromatyczny indyjski Dhal z czerwonej soczewicy i mleczka kokosowego', 'Mleczko kokosowe', 250, 'g'),
    ('Aromatyczny indyjski Dhal z czerwonej soczewicy i mleczka kokosowego', 'Pomidory pelati w puszce', 200, 'g'),
    ('Aromatyczny indyjski Dhal z czerwonej soczewicy i mleczka kokosowego', 'Cebula żółta', 1, 'szt'),
    ('Aromatyczny indyjski Dhal z czerwonej soczewicy i mleczka kokosowego', 'Oliwa z oliwek Extra Virgin', 15, 'g'),
    ('Quesadilla z ciągnącym cheddarem, kukurydzą i świeżym awokado', 'Tortilla pszenna pełnoziarnista', 2, 'szt'),
    ('Quesadilla z ciągnącym cheddarem, kukurydzą i świeżym awokado', 'Ser Cheddar tarty', 120, 'g'),
    ('Quesadilla z ciągnącym cheddarem, kukurydzą i świeżym awokado', 'Kukurydza konserwowa', 80, 'g'),
    ('Quesadilla z ciągnącym cheddarem, kukurydzą i świeżym awokado', 'Papryka czerwona', 80, 'g'),
    ('Quesadilla z ciągnącym cheddarem, kukurydzą i świeżym awokado', 'Awokado Hass', 1, 'szt'),
    ('Puszyste placuszki twarogowo-bananowe z płatkami owsianymi', 'Płatki owsiane górskie', 120, 'g'),
    ('Puszyste placuszki twarogowo-bananowe z płatkami owsianymi', 'Banan', 2, 'szt'),
    ('Puszyste placuszki twarogowo-bananowe z płatkami owsianymi', 'Miód pszczeli wielokwiatowy', 30, 'g'),
    ('Puszyste placuszki twarogowo-bananowe z płatkami owsianymi', 'Twaróg półtłusty', 200, 'g'),
    ('Złociste ziemniaki i marchewki pieczone z masłem i oliwą', 'Ziemniaki młode', 800, 'g'),
    ('Złociste ziemniaki i marchewki pieczone z masłem i oliwą', 'Marchew', 300, 'g'),
    ('Złociste ziemniaki i marchewki pieczone z masłem i oliwą', 'Oliwa z oliwek Extra Virgin', 25, 'g'),
    ('Złociste ziemniaki i marchewki pieczone z masłem i oliwą', 'Masło ekstra 82%', 30, 'g'),
    ('Zapiekanka ziemniaczana Gratin z mozzarellą i cheddarem', 'Ziemniaki młode', 1000, 'g'),
    ('Zapiekanka ziemniaczana Gratin z mozzarellą i cheddarem', 'Cebula żółta', 2, 'szt'),
    ('Zapiekanka ziemniaczana Gratin z mozzarellą i cheddarem', 'Ser Cheddar tarty', 100, 'g'),
    ('Zapiekanka ziemniaczana Gratin z mozzarellą i cheddarem', 'Masło ekstra 82%', 40, 'g'),
    ('Zapiekanka ziemniaczana Gratin z mozzarellą i cheddarem', 'Ser Mozzarella kulka', 125, 'g'),
    ('Kurczak curry z mleczkiem kokosowym i ryżem', 'Pierś z kurczaka', 300, 'g'),
    ('Kurczak curry z mleczkiem kokosowym i ryżem', 'Mleczko kokosowe', 200, 'g'),
    ('Kurczak curry z mleczkiem kokosowym i ryżem', 'Ryż jaśminowy', 150, 'g'),
    ('Kurczak curry z mleczkiem kokosowym i ryżem', 'Cebula żółta', 1, 'szt'),
    ('Kurczak curry z mleczkiem kokosowym i ryżem', 'Papryka czerwona', 100, 'g'),
    ('Zupa pomidorowa z czosnkiem i śmietanką', 'Pomidory pelati w puszce', 400, 'g'),
    ('Zupa pomidorowa z czosnkiem i śmietanką', 'Cebula żółta', 1, 'szt'),
    ('Zupa pomidorowa z czosnkiem i śmietanką', 'Czosnek', 1, 'szt'),
    ('Zupa pomidorowa z czosnkiem i śmietanką', 'Śmietanka 30%', 50, 'ml'),
    ('Omlet ze szpinakiem i cheddarem', 'Jajka wiejskie', 3, 'szt'),
    ('Omlet ze szpinakiem i cheddarem', 'Szpinak świeży', 50, 'g'),
    ('Omlet ze szpinakiem i cheddarem', 'Ser Cheddar tarty', 40, 'g'),
    ('Omlet ze szpinakiem i cheddarem', 'Masło ekstra 82%', 10, 'g'),
    ('Sałatka z awokado, kukurydzą i papryką', 'Awokado Hass', 1, 'szt'),
    ('Sałatka z awokado, kukurydzą i papryką', 'Kukurydza konserwowa', 100, 'g'),
    ('Sałatka z awokado, kukurydzą i papryką', 'Papryka czerwona', 100, 'g'),
    ('Sałatka z awokado, kukurydzą i papryką', 'Oliwa z oliwek Extra Virgin', 10, 'g'),
    ('Sałatka z awokado, kukurydzą i papryką', 'Cytryna', 1, 'szt'),
    ('Tortilla z kurczakiem i papryką', 'Tortilla pszenna pełnoziarnista', 2, 'szt'),
    ('Tortilla z kurczakiem i papryką', 'Pierś z kurczaka', 200, 'g'),
    ('Tortilla z kurczakiem i papryką', 'Papryka czerwona', 100, 'g'),
    ('Tortilla z kurczakiem i papryką', 'Ser Cheddar tarty', 50, 'g'),
    ('Jogurt grecki z bananem i miodem', 'Jogurt grecki', 200, 'g'),
    ('Jogurt grecki z bananem i miodem', 'Banan', 1, 'szt'),
    ('Jogurt grecki z bananem i miodem', 'Miód pszczeli wielokwiatowy', 15, 'g'),
    ('Krem z marchwi i czerwonej soczewicy', 'Marchew', 400, 'g'),
    ('Krem z marchwi i czerwonej soczewicy', 'Soczewica czerwona sucha', 150, 'g'),
    ('Krem z marchwi i czerwonej soczewicy', 'Cebula żółta', 1, 'szt'),
    ('Krem z marchwi i czerwonej soczewicy', 'Oliwa z oliwek Extra Virgin', 10, 'g'),
    ('Ryż smażony z warzywami i jajkiem', 'Ryż jaśminowy', 150, 'g'),
    ('Ryż smażony z warzywami i jajkiem', 'Marchew', 100, 'g'),
    ('Ryż smażony z warzywami i jajkiem', 'Papryka czerwona', 100, 'g'),
    ('Ryż smażony z warzywami i jajkiem', 'Jajka wiejskie', 2, 'szt'),
    ('Ryż smażony z warzywami i jajkiem', 'Oliwa z oliwek Extra Virgin', 15, 'g'),
    ('Tortilla z awokado i jajkiem', 'Tortilla pszenna pełnoziarnista', 1, 'szt'),
    ('Tortilla z awokado i jajkiem', 'Awokado Hass', 1, 'szt'),
    ('Tortilla z awokado i jajkiem', 'Jajka wiejskie', 1, 'szt'),
    ('Tortilla z awokado i jajkiem', 'Cytryna', 1, 'szt')
) AS v(przepis, skladnik, qty, unit_meas)
JOIN przepisy p ON p.nazwa = v.przepis
JOIN skladniki s ON s.nazwa = v.skladnik
WHERE NOT EXISTS (
    SELECT 1 FROM przepis_skladniki ps WHERE ps.przepis_id = p.id AND ps.skladnik_id = s.id
);

INSERT INTO spizarnia (skladnik_id, opis, qty, unit_meas, expire_date, kalorie)
SELECT s.id, v.opis, v.qty, v.unit_meas::unit_meas_enum, CURRENT_DATE + v.dni, v.kalorie
FROM (VALUES
    ('Makaron Penne', 'Opakowanie pełnoziarniste', 500, 'g', 120, 355),
    ('Szpinak świeży', 'Liście baby', 200, 'g', 2, 23),
    ('Suszone pomidory', 'W zalewie z olejem', 150, 'g', 45, 258),
    ('Śmietanka 30%', 'Kartonik UHT', 300, 'ml', 1, 292),
    ('Pierś z kurczaka', 'Filet świeży', 600, 'g', 3, 110),
    ('Jajka wiejskie', 'Klasa M', 8, 'szt', 14, 143),
    ('Czosnek', 'Główka polski', 3, 'szt', 30, 149),
    ('Mleko 3.2%', 'Otwarte w lodówce', 1, 'l', -1, 61),
    ('Ryż jaśminowy', 'Torebki 4x100g', 800, 'g', 300, 348),
    ('Oliwa z oliwek Extra Virgin', 'Butelka ciemne szkło', 750, 'g', 240, 884),
    ('Płatki owsiane górskie', 'Opakowanie papierowe', 1000, 'g', 180, 366),
    ('Miód pszczeli wielokwiatowy', 'Słoik z pasieki', 450, 'g', 365, 304),
    ('Masło orzechowe 100%', 'Crunchy bez cukru', 500, 'g', 150, 588),
    ('Pomidory pelati w puszce', 'Puszka włoskie', 800, 'g', 400, 22),
    ('Fasola czerwona konserwowa', 'W zalewie puszka', 400, 'g', 320, 95),
    ('Kukurydza konserwowa', 'Złocista puszka', 300, 'g', 290, 86),
    ('Soczewica czerwona sucha', 'Szybkowarząca', 500, 'g', 260, 341),
    ('Mleczko kokosowe', 'Puszka 18% tłuszczu', 400, 'g', 210, 185),
    ('Ziemniaki młode', 'Siateczka kuchnia', 2500, 'g', 25, 77),
    ('Cebula żółta', 'Koszyk warzywny', 6, 'szt', 30, 40),
    ('Marchew', 'Świeża myta', 600, 'g', 14, 41),
    ('Cytryna', 'Włoska niewoskowana', 4, 'szt', 12, 29),
    ('Banan', 'Kiść na blacie', 5, 'szt', 5, 89),
    ('Tortilla pszenna pełnoziarnista', 'Paczka 4 placki', 4, 'szt', 18, 298),
    ('Masło ekstra 82%', 'Kostka w maselniczce', 200, 'g', 20, 748),
    ('Łosoś świeży filet', 'Porcja na tackach (pilne!)', 450, 'g', 1, 208),
    ('Mięso mielone wołowe', 'Pakowane próżniowo', 500, 'g', 2, 254),
    ('Brokuł świeży', 'Sztuka z lodówki', 400, 'g', 2, 34),
    ('Jogurt grecki', 'Kubek duży 400g', 400, 'g', 3, 115),
    ('Papryka czerwona', 'Słodka czerwona', 350, 'g', 1, 31),
    ('Ser Cheddar tarty', 'Otwarte opakowanie', 200, 'g', 3, 403),
    ('Twaróg półtłusty', 'Krajanka otwarta tydzień temu', 250, 'g', -3, 133),
    ('Ser Mozzarella kulka', 'W zalewie serwatkowej', 125, 'g', -2, 248)
) AS v(skladnik, opis, qty, unit_meas, dni, kalorie)
JOIN skladniki s ON s.nazwa = v.skladnik
WHERE NOT EXISTS (
    SELECT 1 FROM spizarnia x WHERE x.skladnik_id = s.id AND x.opis IS NOT DISTINCT FROM v.opis
);

COMMIT;
