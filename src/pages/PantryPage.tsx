import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Trash2,
  Edit2,
  RefreshCw,
  X,
  Check,
  ServerCrash,
  Barcode,
  FlaskConical
} from 'lucide-react';
import { apiFetch, ApiError } from '../api';
import { UNITS, isValidUnit } from '../constants';

// ==========================================
// MODEL DANYCH SPIŻARNI
// ==========================================
// Pola jak w bazie: GET/POST /api/spizarnia, PUT/DELETE /api/spizarnia/:id.

/** Ile dni przed końcem daty ważności produkt dostaje ostrzeżenie. */
const SHORT_DATE_DAYS = 3;

const DAY_MS = 1000 * 60 * 60 * 24;

type ApiPantryRow = {
  id?: number | string | null;
  nazwa?: string | null;
  qty?: number | string | null;
  unit_meas?: string | null;
  expire_date?: string | null;
  kalorie?: number | string | null;
};

export interface PantryItem {
  /** null, gdy backend nie zwraca jeszcze identyfikatora – wtedy edycja/usuwanie są wyłączone. */
  id: number | string | null;
  nazwa: string;
  qty: number;
  unit_meas: string;
  /** Data w formacie RRRR-MM-DD albo null. */
  expire_date: string | null;
  kalorie: number | null;
}

type FormState = {
  nazwa: string;
  barcode: string;
  qty: string;
  unit_meas: string;
  expire_date: string;
  kalorie: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  nazwa: '',
  barcode: '',
  qty: '1',
  unit_meas: 'szt',
  expire_date: '',
  kalorie: ''
};

// Interfejs dla odpowiedzi z OpenFoodFacts API
interface OFFProduct {
  product_name?: string;
  code?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
  };
}

// ==========================================
// FUNKCJE POMOCNICZE
// ==========================================
const pad = (n: number) => String(n).padStart(2, '0');

const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Sterownik pg zamienia kolumnę DATE na obiekt Date (północ czasu lokalnego serwera),
 * a JSON zapisuje go w UTC, np. „2026-11-19T23:00:00.000Z” dla 20 listopada.
 * Dlatego datę z czasem przeliczamy na lokalny dzień, a sam dzień zostawiamy bez zmian.
 */
const normalizeDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : toIsoDate(parsed);
};

const parseLocalDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

const daysUntil = (iso: string | null, today: number) =>
  iso === null ? Infinity : Math.round((parseLocalDate(iso) - today) / DAY_MS);

const formatDate = (iso: string) =>
  new Date(parseLocalDate(iso)).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const fromApi = (row: ApiPantryRow): PantryItem => ({
  id: row.id ?? null,
  nazwa: row.nazwa?.trim() || '(bez nazwy)',
  qty: toNumberOrNull(row.qty) ?? 0,
  unit_meas: row.unit_meas ?? '',
  expire_date: normalizeDate(row.expire_date),
  kalorie: toNumberOrNull(row.kalorie)
});

const toForm = (item: PantryItem): FormState => ({
  nazwa: item.nazwa,
  barcode: '',
  qty: String(item.qty),
  unit_meas: item.unit_meas || 'szt',
  expire_date: item.expire_date ?? '',
  kalorie: item.kalorie === null ? '' : String(item.kalorie)
});

const validate = (form: FormState): FormErrors => {
  const errors: FormErrors = {};
  const name = form.nazwa.trim();
  const quantity = Number(form.qty.replace(',', '.'));

  if (!name) errors.nazwa = 'Podaj nazwę produktu.';
  else if (name.length > 100) errors.nazwa = 'Nazwa może mieć najwyżej 100 znaków.';

  if (form.qty.trim() === '' || !Number.isFinite(quantity)) {
    errors.qty = 'Podaj ilość.';
  } else if (quantity <= 0) {
    errors.qty = 'Ilość musi być większa od zera.';
  } else if (quantity >= 100_000_000) {
    errors.qty = 'Ilość jest za duża.';
  }

  if (!isValidUnit(form.unit_meas)) errors.unit_meas = 'Wybierz jednostkę.';

  if (form.kalorie.trim() !== '') {
    const kcal = Number(form.kalorie.replace(',', '.'));
    if (!Number.isInteger(kcal) || kcal < 0) {
      errors.kalorie = 'Kalorie to liczba całkowita ≥ 0.';
    }
  }

  if (form.expire_date && !/^\d{4}-\d{2}-\d{2}$/.test(form.expire_date)) {
    errors.expire_date = 'Nieprawidłowa data.';
  }

  if (form.barcode && !/^\d{8,14}$/.test(form.barcode.trim())) {
    errors.barcode = 'Kod EAN to 8–14 cyfr.';
  }

  return errors;
};

/** Dane wysyłane do backendu – nazwy pól jak w bazie. */
const toApiPayload = (form: FormState) => ({
  nazwa: form.nazwa.trim(),
  qty: Number(form.qty.replace(',', '.')),
  unit_meas: form.unit_meas,
  expire_date: form.expire_date || null,
  kalorie: form.kalorie.trim() === '' ? null : Number(form.kalorie)
});

/** Przykładowe produkty do pokazu, gdy backend lub baza nie są uruchomione. */
const buildDemoItems = (): PantryItem[] => {
  const inDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return toIsoDate(d);
  };
  return [
    { id: 'demo-1', nazwa: 'Mleko 3,2%', qty: 1, unit_meas: 'l', expire_date: inDays(2), kalorie: 60 },
    { id: 'demo-2', nazwa: 'Jajka', qty: 10, unit_meas: 'szt', expire_date: inDays(12), kalorie: 143 },
    { id: 'demo-3', nazwa: 'Mąka pszenna', qty: 1, unit_meas: 'kg', expire_date: inDays(180), kalorie: 348 },
    { id: 'demo-4', nazwa: 'Jogurt naturalny', qty: 2, unit_meas: 'szt', expire_date: inDays(-1), kalorie: 61 },
    { id: 'demo-5', nazwa: 'Pomidory', qty: 500, unit_meas: 'g', expire_date: inDays(4), kalorie: 18 },
    { id: 'demo-6', nazwa: 'Makaron spaghetti', qty: 2, unit_meas: 'opak.', expire_date: inDays(300), kalorie: 357 },
    { id: 'demo-7', nazwa: 'Masło', qty: 200, unit_meas: 'g', expire_date: inDays(0), kalorie: 735 },
    { id: 'demo-8', nazwa: 'Ryż basmati', qty: 1, unit_meas: 'kg', expire_date: null, kalorie: null }
  ];
};

const errorText = (err: unknown, fallback: string) => {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'Ta operacja nie jest jeszcze dostępna na serwerze.';
    return err.message;
  }
  return fallback;
};

const inputClass = (hasError: boolean) =>
  `w-full px-3 py-2 rounded-xl bg-slate-950 border text-sm text-white focus:outline-none transition ${
    hasError ? 'border-rose-500/70 focus:border-rose-400' : 'border-slate-800 focus:border-emerald-500'
  }`;

// ==========================================
// KOMPONENT STRONY
// ==========================================
export default function PantryPage() {
  // Stany danych pobieranych z bazy danych
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [today, setToday] = useState<number>(startOfToday);

  // Stany wyszukiwania i filtrowania lokalnego
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'expired' | 'short_date'>('all');

  // Stany modalu dodawania/edycji produktu
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [offMessage, setOffMessage] = useState<string | null>(null);
  const [isSearchingOFF, setIsSearchingOFF] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Pobieranie danych z backendu Node.js
  const loadPantryData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setToday(startOfToday());

    try {
      const data = await apiFetch<ApiPantryRow[]>('/spizarnia');
      setPantryItems(Array.isArray(data) ? data.map(fromApi) : []);
      setDbConnected(true);
      setDemoMode(false);
    } catch (err: unknown) {
      setDbConnected(false);
      setPantryItems([]);
      setErrorMessage(
        errorText(err, 'Brak połączenia z backendem (Node.js / PostgreSQL).')
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPantryData();
  }, [loadPantryData]);

  // Komunikat o powodzeniu znika po kilku sekundach
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const startDemo = () => {
    setToday(startOfToday());
    setPantryItems(buildDemoItems());
    setDemoMode(true);
    setErrorMessage(null);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
    setSubmitError(null);
  };

  // Obsługa API zewnętrznego - OpenFoodFacts (wyszukiwanie produktu po EAN lub nazwie)
  const searchOpenFoodFacts = async () => {
    const barcode = formData.barcode.trim();
    const name = formData.nazwa.trim();
    if (!barcode && !name) return;

    setIsSearchingOFF(true);
    setOffMessage(null);

    try {
      const url = barcode
        ? `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
        : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
            name
          )}&search_simple=1&action=process&json=1&page_size=1`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const product: OFFProduct | undefined = barcode ? data.product : data.products?.[0];

      if (product) {
        const kcal = product.nutriments?.['energy-kcal_100g'];
        setFormData((prev) => ({
          ...prev,
          nazwa: product.product_name?.trim() || prev.nazwa,
          barcode: product.code || prev.barcode,
          kalorie: typeof kcal === 'number' ? String(Math.round(kcal)) : prev.kalorie
        }));
        setFormErrors({});
        setOffMessage('Uzupełniono dane z OpenFoodFacts – sprawdź je przed zapisem.');
      } else {
        setOffMessage('Nie znaleziono produktu w OpenFoodFacts. Uzupełnij dane ręcznie.');
      }
    } catch (error) {
      console.error('Błąd pobierania danych z OpenFoodFacts', error);
      setOffMessage('Nie udało się połączyć z OpenFoodFacts. Uzupełnij dane ręcznie.');
    } finally {
      setIsSearchingOFF(false);
    }
  };

  // Zapis produktu (POST / PUT) – w trybie demo tylko lokalnie
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validate(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = toApiPayload(formData);

    if (demoMode) {
      const saved: PantryItem = {
        id: editingItem?.id ?? `demo-${Date.now()}`,
        nazwa: payload.nazwa,
        qty: payload.qty,
        unit_meas: payload.unit_meas,
        expire_date: payload.expire_date,
        kalorie: payload.kalorie
      };
      setPantryItems((prev) =>
        editingItem ? prev.map((it) => (it.id === editingItem.id ? saved : it)) : [...prev, saved]
      );
      setNotice(editingItem ? 'Zapisano zmiany.' : 'Dodano produkt do spiżarni.');
      closeModal();
      return;
    }

    setIsSaving(true);
    setSubmitError(null);
    try {
      if (editingItem) {
        await apiFetch(`/spizarnia/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/spizarnia', { method: 'POST', body: JSON.stringify(payload) });
      }
      setNotice(editingItem ? 'Zapisano zmiany.' : 'Dodano produkt do spiżarni.');
      closeModal();
      await loadPantryData();
    } catch (err) {
      setSubmitError(errorText(err, 'Nie udało się zapisać produktu.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Usuwanie produktu (DELETE)
  const handleDeleteProduct = async (item: PantryItem) => {
    if (item.id === null) return;
    if (!window.confirm(`Usunąć „${item.nazwa}” ze spiżarni?`)) return;

    if (!demoMode) {
      try {
        await apiFetch(`/spizarnia/${item.id}`, { method: 'DELETE' });
      } catch (err) {
        setErrorMessage(errorText(err, 'Nie udało się usunąć produktu.'));
        return;
      }
    }

    setPantryItems((prev) => prev.filter((it) => it.id !== item.id));
    setNotice('Usunięto produkt.');
  };

  // Otwieranie/zamykanie modalu
  const openModal = (item?: PantryItem) => {
    setEditingItem(item ?? null);
    setFormData(item ? toForm(item) : EMPTY_FORM);
    setFormErrors({});
    setSubmitError(null);
    setOffMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // Zamknięcie modalu klawiszem Esc
  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen]);

  // Filtrowanie i sortowanie listy produktów
  const processedItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return pantryItems
      .map((item) => {
        const days = daysUntil(item.expire_date, today);
        return {
          item,
          days,
          isExpired: days < 0,
          isShortDate: days >= 0 && days <= SHORT_DATE_DAYS
        };
      })
      .filter(({ item, isExpired, isShortDate }) => {
        if (query && !item.nazwa.toLowerCase().includes(query)) return false;
        if (filterType === 'expired') return isExpired;
        if (filterType === 'short_date') return isShortDate;
        return true;
      })
      // Najpierw przeterminowane, potem krótkie daty, na końcu produkty bez daty
      .sort((a, b) => a.days - b.days || a.item.nazwa.localeCompare(b.item.nazwa, 'pl'));
  }, [pantryItems, searchQuery, filterType, today]);

  const counts = useMemo(() => {
    let expired = 0;
    let shortDate = 0;
    for (const item of pantryItems) {
      const days = daysUntil(item.expire_date, today);
      if (days < 0) expired++;
      else if (days <= SHORT_DATE_DAYS) shortDate++;
    }
    return { all: pantryItems.length, expired, shortDate };
  }, [pantryItems, today]);

  const showList = dbConnected || demoMode;

  return (
    <main className="p-4 sm:p-8 space-y-6 sm:space-y-8">
      {/* Nagłówek i akcje */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-emerald-400" />
            Spiżarnia
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Zarządzaj swoimi produktami, kontroluj kalorie i daty ważności.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadPantryData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-sm font-medium transition disabled:opacity-50"
            title="Odśwież dane z bazy"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
          <button
            onClick={() => openModal()}
            disabled={!showList}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Dodaj produkt
          </button>
        </div>
      </header>

      {/* Komunikat o powodzeniu */}
      {notice && (
        <div
          role="status"
          className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300 flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          {notice}
        </div>
      )}

      {/* Tryb demo */}
      {demoMode && (
        <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center gap-3">
          <FlaskConical className="w-5 h-5 text-sky-300 shrink-0" />
          <p className="text-sm text-sky-100 flex-1">
            <strong>Tryb demo</strong> – przykładowe produkty, zmiany nie są zapisywane w bazie.
          </p>
          <button
            onClick={loadPantryData}
            className="text-sm font-medium text-sky-300 hover:text-sky-200 underline underline-offset-2"
          >
            Połącz ponownie z API
          </button>
        </div>
      )}

      {/* Pasek błędów API / bazy */}
      {!isLoading && !showList && errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center gap-3">
          <ServerCrash className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-200 flex-1">
            {errorMessage} Uruchom serwer z katalogu <code>backend/</code> (npm run dev).
          </p>
          <button
            onClick={startDemo}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm font-medium text-slate-100 transition"
          >
            <FlaskConical className="w-4 h-4" />
            Pokaż dane przykładowe
          </button>
        </div>
      )}

      {/* Błąd operacji przy działającym API (np. usuwanie) */}
      {showList && errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-300 hover:text-white"
            aria-label="Zamknij komunikat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filtry i wyszukiwarka */}
      <div className="flex flex-col lg:flex-row gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Wyszukaj produkt w spiżarni..."
            aria-label="Wyszukaj produkt"
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType('all')}
            aria-pressed={filterType === 'all'}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterType === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Wszystkie ({counts.all})
          </button>
          <button
            onClick={() => setFilterType('short_date')}
            aria-pressed={filterType === 'short_date'}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterType === 'short_date'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-amber-300 border border-slate-800'
            }`}
          >
            Krótka data ({counts.shortDate})
          </button>
          <button
            onClick={() => setFilterType('expired')}
            aria-pressed={filterType === 'expired'}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterType === 'expired'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-rose-300 border border-slate-800'
            }`}
          >
            Przeterminowane ({counts.expired})
          </button>
        </div>
      </div>

      {/* Lista produktów */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : processedItems.length === 0 ? (
        <div className="py-16 px-4 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800">
          <Package className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300">Brak produktów</h3>
          <p className="text-sm text-slate-500 mt-1">
            {!showList
              ? 'Nie udało się pobrać danych ze spiżarni.'
              : pantryItems.length === 0
              ? 'Spiżarnia jest pusta – dodaj pierwszy produkt.'
              : 'Żaden produkt nie spełnia kryteriów wyszukiwania.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {processedItems.map(({ item, days, isExpired, isShortDate }, index) => {
            const canModify = item.id !== null;

            return (
              <div
                key={item.id ?? `row-${index}`}
                className={`p-5 rounded-2xl border flex flex-col justify-between group transition ${
                  isExpired
                    ? 'bg-rose-950/20 border-rose-900/50'
                    : isShortDate
                    ? 'bg-amber-950/20 border-amber-900/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <h4
                      className={`font-semibold truncate ${
                        isExpired ? 'text-rose-400 line-through' : 'text-white'
                      }`}
                      title={item.nazwa}
                    >
                      {item.nazwa}
                    </h4>
                    {(isExpired || isShortDate) && (
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          isExpired
                            ? 'bg-rose-500/15 text-rose-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {isExpired
                          ? 'Po terminie'
                          : days === 0
                          ? 'Dziś'
                          : days === 1
                          ? 'Jutro'
                          : `${days} dni`}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <p className="text-slate-400 flex justify-between gap-2">
                      <span>Ilość:</span>
                      <span className="font-medium text-slate-200">
                        {item.qty.toLocaleString('pl-PL')} {item.unit_meas}
                      </span>
                    </p>
                    {item.kalorie !== null && item.kalorie > 0 && (
                      <p className="text-slate-400 flex justify-between gap-2">
                        <span>Kalorie:</span>
                        <span className="font-medium text-slate-200">{item.kalorie} kcal/100 g</span>
                      </p>
                    )}
                    <p
                      className={`flex justify-between gap-2 ${
                        isExpired
                          ? 'text-rose-400'
                          : isShortDate
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      <span>Data ważności:</span>
                      <span className="font-medium">
                        {item.expire_date ? formatDate(item.expire_date) : '—'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Na telefonie przyciski są zawsze widoczne, na komputerze po najechaniu */}
                <div className="mt-5 pt-4 border-t border-slate-800/50 flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={() => openModal(item)}
                    disabled={!canModify}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title={canModify ? 'Edytuj produkt' : 'Brak identyfikatora produktu z API'}
                    aria-label={`Edytuj ${item.nazwa}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(item)}
                    disabled={!canModify}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title={canModify ? 'Usuń ze spiżarni' : 'Brak identyfikatora produktu z API'}
                    aria-label={`Usuń ${item.nazwa}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal dodawania / edycji */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pantry-modal-title"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 id="pantry-modal-title" className="text-lg font-bold text-white">
                {editingItem ? 'Edytuj produkt' : 'Dodaj do spiżarni'}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white transition"
                aria-label="Zamknij"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} noValidate className="p-5 space-y-4">
              {/* Nazwa */}
              <div className="space-y-1">
                <label htmlFor="pantry-name" className="text-xs font-medium text-slate-400">
                  Nazwa produktu *
                </label>
                <input
                  id="pantry-name"
                  type="text"
                  autoFocus
                  maxLength={100}
                  value={formData.nazwa}
                  onChange={(e) => updateField('nazwa', e.target.value)}
                  placeholder="np. Mleko 3,2%"
                  aria-invalid={Boolean(formErrors.nazwa)}
                  className={inputClass(Boolean(formErrors.nazwa))}
                />
                {formErrors.nazwa && <p className="text-xs text-rose-400">{formErrors.nazwa}</p>}
              </div>

              {/* Integracja OpenFoodFacts */}
              <div className="space-y-1">
                <label htmlFor="pantry-ean" className="text-xs font-medium text-slate-400">
                  Kod EAN (opcjonalnie)
                </label>
                <div className="flex gap-2">
                  <input
                    id="pantry-ean"
                    type="text"
                    inputMode="numeric"
                    value={formData.barcode}
                    onChange={(e) => updateField('barcode', e.target.value.replace(/\D/g, ''))}
                    placeholder="np. 5901234567890"
                    aria-invalid={Boolean(formErrors.barcode)}
                    className={`flex-1 min-w-0 ${inputClass(Boolean(formErrors.barcode))}`}
                  />
                  <button
                    type="button"
                    onClick={searchOpenFoodFacts}
                    disabled={isSearchingOFF || (!formData.nazwa.trim() && !formData.barcode.trim())}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-emerald-400 text-sm font-medium transition flex items-center gap-2 disabled:opacity-50 shrink-0"
                  >
                    {isSearchingOFF ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Barcode className="w-4 h-4" />
                    )}
                    Szukaj
                  </button>
                </div>
                {formErrors.barcode ? (
                  <p className="text-xs text-rose-400">{formErrors.barcode}</p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    {offMessage ??
                      'Podaj kod EAN lub nazwę i kliknij „Szukaj”, aby pobrać kalorie z OpenFoodFacts.'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="pantry-qty" className="text-xs font-medium text-slate-400">
                    Ilość *
                  </label>
                  <input
                    id="pantry-qty"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formData.qty}
                    onChange={(e) => updateField('qty', e.target.value)}
                    aria-invalid={Boolean(formErrors.qty)}
                    className={inputClass(Boolean(formErrors.qty))}
                  />
                  {formErrors.qty && (
                    <p className="text-xs text-rose-400">{formErrors.qty}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label htmlFor="pantry-unit" className="text-xs font-medium text-slate-400">
                    Jednostka *
                  </label>
                  <select
                    id="pantry-unit"
                    value={formData.unit_meas}
                    onChange={(e) => updateField('unit_meas', e.target.value)}
                    aria-invalid={Boolean(formErrors.unit_meas)}
                    className={inputClass(Boolean(formErrors.unit_meas))}
                  >
                    {UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.unit_meas && <p className="text-xs text-rose-400">{formErrors.unit_meas}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="pantry-kcal" className="text-xs font-medium text-slate-400">
                    Kalorie (kcal/100 g)
                  </label>
                  <input
                    id="pantry-kcal"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.kalorie}
                    onChange={(e) => updateField('kalorie', e.target.value)}
                    placeholder="Opcjonalnie"
                    aria-invalid={Boolean(formErrors.kalorie)}
                    className={inputClass(Boolean(formErrors.kalorie))}
                  />
                  {formErrors.kalorie && <p className="text-xs text-rose-400">{formErrors.kalorie}</p>}
                </div>
                <div className="space-y-1">
                  <label htmlFor="pantry-date" className="text-xs font-medium text-slate-400">
                    Data ważności
                  </label>
                  <input
                    id="pantry-date"
                    type="date"
                    value={formData.expire_date}
                    onChange={(e) => updateField('expire_date', e.target.value)}
                    aria-invalid={Boolean(formErrors.expire_date)}
                    className={`${inputClass(Boolean(formErrors.expire_date))} [color-scheme:dark]`}
                  />
                  {formErrors.expire_date && (
                    <p className="text-xs text-rose-400">{formErrors.expire_date}</p>
                  )}
                </div>
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200"
                >
                  {submitError}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-white transition"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {editingItem ? 'Zapisz zmiany' : 'Dodaj produkt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
