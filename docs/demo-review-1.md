# Demo na Review 1

Czas: około 8 minut. Cel: pokazać, że działa kamień milowy M1, czyli dodawanie i edycja produktów, wyposażenia oraz przepisów na prawdziwej bazie.

## Przed zajęciami

- [ ] Uruchom API i frontend według README albo otwórz wersję wdrożoną.
- [ ] Przy wersji na darmowym Renderze otwórz aplikację 1–2 minuty wcześniej, bo API może się wybudzać.
- [ ] Sprawdź, czy w pasku bocznym jest status **Połączono**.
- [ ] Otwórz w osobnych kartach tablicę Jira i repozytorium na GitHubie.
- [ ] Sprawdź, czy w bazie nie zostały wpisy z poprzedniej próby.

## Scenariusz

| Czas | Ekran | Co pokazać | Co powiedzieć |
|---|---|---|---|
| 1 min | Strona główna | Liczniki spiżarni, terminów, przepisów i sprzętu | Dane pochodzą z PostgreSQL przez API w Node.js. |
| 2 min | Spiżarnia | Kliknij **Dodaj produkt** i zapisz pusty formularz, żeby pokazać błąd. Dodaj `Kasza gryczana DEMO`, 500 g, z datą ważności. Potem zmień ilość na 400 g. | Formularz sprawdza dane, a produkt od razu pojawia się na liście. |
| 1 min | Spiżarnia | Użyj filtrów **Krótka data** i **Przeterminowane**. | Użytkownik widzi, co trzeba zużyć najpierw. |
| 2 min | Wyposażenie kuchni | Dodaj `Blender DEMO`, zmień status na **W naprawie**, a potem edytuj nazwę lub notatkę. | Stan sprzętu wpływa na dopasowanie przepisów. |
| 2 min | Przepisy | Kliknij **Dodaj przepis**, dodaj nazwę `Kasza DEMO`, składnik z listy, ilość, sprzęt i krok. Po zapisie otwórz edycję i zmień czas. | Przepis zapisuje się razem ze składnikami i można go ponownie edytować. |

Jeśli zostanie czas, pokaż w Jirze ukończone zadania, a na GitHubie gałąź `main` i przykładowy Pull Request.

## Po pokazie

Usuń `Kasza gryczana DEMO`, `Blender DEMO` i `Kasza DEMO`. W pokazie nie klikaj **Ugotowano** na prawdziwych danych, bo odejmuje to składniki ze spiżarni.

## Gdy coś nie działa

| Objaw | Co zrobić |
|---|---|
| Status **Offline** | Odśwież po minucie. Lokalnie sprawdź, czy działa `npm run dev` w `server/`. |
| Błąd zapisu | Pokaż pozostałe funkcje, a komunikat zapisz do poprawy po zajęciach. |
| Brak połączenia z bazą | Na stronie spiżarni kliknij **Pokaż dane przykładowe**, żeby pokazać interfejs, i powiedz, że to tryb demonstracyjny. |
