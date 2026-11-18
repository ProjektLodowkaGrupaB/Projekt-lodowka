// ==========================================
// MODEL DANYCH – NAZWY PÓL JAK W BAZIE
// ==========================================
// Pola tabel mają nazwy kolumn z PostgreSQL. Dodatkowe pola wyliczane przez API:
// w_spizarni, brakujace, procent_brakow, sprzet_nazwy, sprzet_gotowy.

export type Skladnik = {
  id: number;
  nazwa: string;
  domyslna_jednostka: string | null;
};

export type SpizarniaProdukt = {
  id: number;
  nazwa: string;
  qty: number;
  unit_meas: string;
  expire_date: string | null;
  kalorie: number | null;
  opis: string | null;
};

export type Sprzet = {
  id: number;
  nazwa: string;
  sprawny: boolean;
  kategoria: string;
  status_opis: string;
  notatki: string;
};

export type PrzepisSkladnik = {
  skladnik_id: number;
  nazwa: string;
  qty: number;
  unit_meas: string;
  w_spizarni?: boolean;
};

export type PrzepisApi = {
  id: number;
  nazwa: string;
  czas: number;
  trudnosc: string | null;
  kalorycznosc: number | null;
  porcja: number;
  opis: string | null;
  ulubione: boolean;
  diety: string[];
  alergeny: string[];
  sprzet: number[] | null;
  sprzet_alternatywny: number[] | null;
  sprzet_nazwy: string[];
  sprzet_gotowy: boolean;
  brakujace: string[];
  procent_brakow: number;
  skladniki: PrzepisSkladnik[];
};

/** Przepis z polem opis rozdzielonym na krótki opis i kroki do wyświetlenia. */
export type Przepis = PrzepisApi & {
  opis_krotki: string;
  kroki: string[];
};

const STEPS_HEADER = 'Przygotowanie:';

/** Baza ma jedno pole opis: kroki są w osobnych liniach, opcjonalnie po nagłówku. */
export const splitRecipeText = (opis: string | null | undefined) => {
  const text = (opis ?? '').trim();
  if (!text) return { opis_krotki: '', kroki: [] as string[] };

  const cleanLines = (value: string) =>
    value
      .split('\n')
      .map((line) => line.replace(/^\s*\d+\.\s*/, '').trim())
      .filter(Boolean);

  const headerIndex = text.indexOf(STEPS_HEADER);
  if (headerIndex !== -1) {
    return {
      opis_krotki: text.slice(0, headerIndex).trim(),
      kroki: cleanLines(text.slice(headerIndex + STEPS_HEADER.length))
    };
  }

  const lines = cleanLines(text);
  return lines.length > 1
    ? { opis_krotki: '', kroki: lines }
    : { opis_krotki: text, kroki: [] };
};

export const joinRecipeText = (opisKrotki: string, kroki: string[]) => {
  const cleanSteps = kroki.map((step) => step.trim()).filter(Boolean);
  const description = opisKrotki.trim();
  const parts = [description];

  if (cleanSteps.length > 0) {
    parts.push(
      `${STEPS_HEADER}\n${cleanSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
    );
  } else if (description.includes('\n')) {
    // Sam nagłówek odróżnia wieloliniowy opis od listy kroków.
    parts.push(STEPS_HEADER);
  }

  return parts.filter(Boolean).join('\n\n') || null;
};

/** Kolumny w bazie mogą być puste, a widoki oczekują wartości do wyświetlenia. */
export const toPrzepis = (przepis: PrzepisApi): Przepis => ({
  ...przepis,
  nazwa: przepis.nazwa ?? '(bez nazwy)',
  czas: przepis.czas ?? 0,
  porcja: przepis.porcja ?? 1,
  ...splitRecipeText(przepis.opis)
});

export const toSprzet = (sprzet: Sprzet): Sprzet => ({
  ...sprzet,
  nazwa: sprzet.nazwa ?? '(bez nazwy)',
  kategoria: sprzet.kategoria ?? 'AGD małe',
  notatki: sprzet.notatki ?? ''
});

/** Liczba pełnych dni do terminu (0 = dziś, wartość ujemna = po terminie). */
export const dniDoTerminu = (expireDate: string, now = new Date()) => {
  const [year, month, day] = expireDate.split('-').map(Number);
  const target = new Date(year, month - 1, day).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
};
