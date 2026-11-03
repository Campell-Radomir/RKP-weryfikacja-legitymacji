# RKP — weryfikacja legitymacji

Responsywna strona weryfikacji legitymacji kapłańskich Rodzimego Kościoła Polskiego. Frontend korzysta z HTML, Bootstrap i jQuery. API jest wdrożone jako Neon Function w Node.js/TypeScript; dane znajdują się w PostgreSQL Neon. Osobny serwer Go nie jest potrzebny.

## Struktura

- `frontend/` — publiczna strona; CSS i JavaScript w osobnych plikach.
- `backend-neon/` — endpoint i testy.
- `database/` — migracje uprawnień; rzeczywista baza jest w Neon.
- `scripts/` — konfiguracja konta odczytującego oraz test wdrożonego API.
- `backend-neon/neon.ts` — deklaracja funkcji `verify`.

## Podgląd strony

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory frontend
```

Otwórz http://127.0.0.1:8080. Formularz jest już podłączony do wdrożonego API. Na hosting WWW przesyłaj **wyłącznie zawartość `frontend/`**, aby nie udostępnić konfiguracji ani sekretów.

## Publiczne API

Projekt: `delicate-lake-27114292`, gałąź `production`.

```text
POST https://br-autumn-butterfly-baznp7u1-verify.compute.c-8.eu-central-1.aws.neon.tech/api/licences/verify
Content-Type: application/json
```

Przykład:

```sh
curl --request POST \
  'https://br-autumn-butterfly-baznp7u1-verify.compute.c-8.eu-central-1.aws.neon.tech/api/licences/verify' \
  --header 'Content-Type: application/json' \
  --data '{"licenceNumber":"RKP/000001/2026"}'
```

Odpowiedź:

```json
{"licenceNumber":"RKP/000001/2026","valid":true}
```

Nieznany numer albo dokument poza okresem ważności zwraca HTTP 200 z `valid: false`. Nieprawidłowe dane zwracają 400, nieobsługiwana metoda 405, zły Content-Type 415, przekroczenie limitu treści 1 KiB — 413, a błąd bazy — 503. Błąd usługi nigdy nie jest zamieniany na wynik „nieważna”. Wyniki nie są cache'owane.

API czyta istniejącą tabelę `public.clergy_id_cards` i sprawdza `valid_form <= CURRENT_TIMESTAMP <= valid_to`. Nazwa `valid_form` odpowiada istniejącej kolumnie (nie została zmieniona na `valid_from`). Granice są konkretnymi momentami typu `timestamptz`, włącznie z końcowym momentem. Data końcowa o godzinie 00:00 nie oznacza końca tego dnia.

## Uprawnienia i edycja

- Dodawanie i zmiana legitymacji odbywa się kontem administracyjnym w konsoli Neon.
- Funkcja używa osobnej roli `rkp_licence_reader`: SELECT wyłącznie kolumn `licence_number`, `valid_form`, `valid_to`.
- RLS pozostaje włączone. Migracja `database/001-api-reader-policy.sql` dopuszcza odczyt wierszy tylko dla tej roli; nie nadaje dostępu rolom anonimowym.
- Obie zmienne połączenia funkcji (`DATABASE_URL` i `DATABASE_URL_UNPOOLED`) są nadpisane danymi konta odczytującego. Funkcja odmawia startu z inną rolą.
- Frontend nie zawiera haseł ani klucza administracyjnego.
- CORS dopuszcza `https://rkp.org.pl`, `https://www.rkp.org.pl` i lokalny podgląd HTTP na `localhost`/`127.0.0.1`. Dodatkową domenę trzeba dopisać w `ALLOWED_ORIGINS` w `backend-neon/neon.ts` i ponownie wdrożyć API.
- Endpoint jest celowo publiczny. CORS nie jest uwierzytelnianiem ani ograniczeniem liczby zapytań i nie blokuje klientów poza przeglądarką. Ta implementacja nie dodaje rate limitera.

## Konfiguracja i wdrożenie

Wymagany Node.js 22+ lokalnie, Neon CLI i zalogowana sesja. Runtime Neon Functions to Node.js 24.

```sh
npm ci
neon init -y --no-agent-setup --project-id delicate-lake-27114292 --branch production --no-config
```

Jeśli projekt jest już połączony, nie trzeba uruchamiać init ponownie. Konto administratora znajduje się w lokalnym `.env.local`. Pliki `.env*` są wykluczone z Git.

Konto odczytujące i polityka są już utworzone w gałęzi production. Przy przygotowywaniu nowego środowiska:

```sh
npm run setup:reader
node scripts/apply-reader-policy.mjs
```

`setup:reader` tworzy rolę i plik `.env.neon-api.local` z uprawnieniami pliku 0600. Nie zmienia istniejącego konta, nie obraca hasła i odmawia ponownego wykonania, jeśli konto lub plik już istnieje. Nie usuwa ani nie zmienia rekordów legitymacji. Zachowaj lokalny plik w bezpiecznym miejscu; nie dodawaj go do Git.

```sh
npm run check
npm test
npm run deploy:api
```

Wdrożenie czyta sekrety z `.env.neon-api.local` i przesyła je jako zmienne środowiskowe funkcji. Nie umieszczaj sekretów w argumentach poleceń ani w `backend-neon/neon.ts`. Gdy funkcja otrzyma nowy adres, zaktualizuj `data-api-url` w `frontend/index.html`.

Test działającego wdrożenia (korzysta z aktualnego adresu w HTML i wskazanego wpisu testowego):

```sh
node scripts/smoke-api.mjs
```

Test sprawdza dodatni wynik istniejącego wpisu, ujemne wyniki nieznanych numerów, walidację i CORS. Dodatni wynik zakłada, że testowa legitymacja pozostaje w okresie ważności.
