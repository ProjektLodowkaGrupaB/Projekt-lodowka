import React, { useEffect, useMemo, useState } from 'react';
import { Check, FlaskConical, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { apiFetch, ApiError } from '../api';
import { DIFFICULTIES, UNITS, isValidUnit, type Difficulty } from '../constants';

// ==========================================
// FORMULARZ DODAWANIA / EDYCJI PRZEPISU (SCRUM-41)
// ==========================================
// Dane wysyłane do backendu (POST /api/przepisy, PUT /api/przepisy/:id – SCRUM-19/20):
// {
//   nazwa, czas, trudnosc, kalorycznosc, porcja, opis,
//   sprzet: number[], sprzet_alternatywny: number[],
//   skladniki: [{ skladnik_id, qty, unit_meas }]
// }
// Słowniki do list wyboru: GET /api/skladniki i GET /api/sprzet.

type Ingredient = { id: number; nazwa: string; domyslna_jednostka?: string | null };
type Equipment = { id: number; nazwa: string; sprawny?: boolean | null };

/** Wartości startowe przy edycji – nazwy pól jak w bazie. */
export type RecipeFormInitial = {
  id: number | string;
  nazwa?: string;
  czas?: number;
  trudnosc?: string;
  kalorycznosc?: number | null;
  porcja?: number;
  opis?: string | null;
  sprzet?: number[];
  skladniki?: { skladnik_id: number; qty: number | string; unit_meas: string }[];
};

type IngredientRow = { key: number; name: string; qty: string; unit: string };

type FormErrors = {
  nazwa?: string;
  czas?: string;
  porcja?: string;
  trudnosc?: string;
  kalorycznosc?: string;
  skladniki?: string;
  rows?: Record<number, string>;
};

type Props = {
  initial: RecipeFormInitial | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

/** Przykładowe słowniki, gdy backend nie udostępnia jeszcze /skladniki i /sprzet. */
const DEMO_INGREDIENTS: Ingredient[] = [
  'Makaron spaghetti', 'Pomidory', 'Czosnek', 'Cebula', 'Oliwa', 'Jajka', 'Mleko',
  'Mąka pszenna', 'Masło', 'Ser żółty', 'Szpinak', 'Ryż basmati', 'Pierś z kurczaka', 'Sól', 'Pieprz'
].map((nazwa, i) => ({ id: i + 1, nazwa, domyslna_jednostka: null }));

const DEMO_EQUIPMENT: Equipment[] = [
  'Piekarnik', 'Patelnia', 'Garnek', 'Blender', 'Mikser', 'Mikrofalówka'
].map((nazwa, i) => ({ id: i + 1, nazwa, sprawny: true }));

let rowKey = 0;
const newRow = (partial: Partial<IngredientRow> = {}): IngredientRow => ({
  key: ++rowKey,
  name: '',
  qty: '',
  unit: 'g',
  ...partial
});

const toInt = (value: string) => {
  const n = Number(value);
  return value.trim() !== '' && Number.isInteger(n) ? n : NaN;
};

const toQty = (value: string) => Number(value.replace(',', '.'));

/** Baza ma jedno pole opis – kroki zapisujemy jako numerowane linie pod opisem. */
const STEPS_HEADER = 'Przygotowanie:';

const splitDescription = (opis: string | null | undefined) => {
  if (!opis) return { description: '', steps: [''] };
  const idx = opis.indexOf(STEPS_HEADER);
  if (idx === -1) return { description: opis, steps: [''] };
  const steps = opis
    .slice(idx + STEPS_HEADER.length)
    .split('\n')
    .map((line) => line.replace(/^\s*\d+\.\s*/, '').trim())
    .filter(Boolean);
  return { description: opis.slice(0, idx).trim(), steps: steps.length ? steps : [''] };
};

const joinDescription = (description: string, steps: string[]) => {
  const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
  const parts = [description.trim()];
  if (cleanSteps.length) {
    parts.push(`${STEPS_HEADER}\n${cleanSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }
  return parts.filter(Boolean).join('\n\n') || null;
};

const inputClass = (hasError = false) =>
  `w-full px-3 py-2 rounded-xl bg-slate-950 border text-sm text-white focus:outline-none transition ${
    hasError ? 'border-rose-500/70 focus:border-rose-400' : 'border-slate-800 focus:border-emerald-500'
  }`;

export default function RecipeFormModal({ initial, onClose, onSaved }: Props) {
  const isEditing = initial !== null;
  const initialText = splitDescription(initial?.opis);

  // Słowniki z bazy
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [dictLoading, setDictLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  // Pola formularza
  const [nazwa, setNazwa] = useState(initial?.nazwa ?? '');
  const [czas, setCzas] = useState(initial?.czas ? String(initial.czas) : '30');
  const [porcja, setPorcja] = useState(initial?.porcja ? String(initial.porcja) : '2');
  const [trudnosc, setTrudnosc] = useState<Difficulty | ''>(
    (DIFFICULTIES as readonly string[]).includes(initial?.trudnosc ?? '')
      ? (initial!.trudnosc as Difficulty)
      : 'łatwy'
  );
  const [kalorycznosc, setKalorycznosc] = useState(
    initial?.kalorycznosc != null ? String(initial.kalorycznosc) : ''
  );
  const [description, setDescription] = useState(initialText.description);
  const [steps, setSteps] = useState<string[]>(initialText.steps);
  const [selectedEquipment, setSelectedEquipment] = useState<number[]>(initial?.sprzet ?? []);
  const [rows, setRows] = useState<IngredientRow[]>([newRow()]);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [demoPayload, setDemoPayload] = useState<string | null>(null);

  // Pobranie słowników składników i sprzętu
  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      apiFetch<Ingredient[]>('/skladniki'),
      apiFetch<Equipment[]>('/sprzet')
    ]).then(([ing, eq]) => {
      if (cancelled) return;
      const ok = ing.status === 'fulfilled' && Array.isArray(ing.value);
      const ingList = ok ? ing.value : DEMO_INGREDIENTS;
      const eqList =
        eq.status === 'fulfilled' && Array.isArray(eq.value) ? eq.value : ok ? [] : DEMO_EQUIPMENT;

      setIngredients(ingList);
      setEquipment(eqList);
      setDemoMode(!ok);

      // Przy edycji zamieniamy skladnik_id na nazwy widoczne w polach
      if (initial?.skladniki?.length) {
        setRows(
          initial.skladniki.map((s) =>
            newRow({
              name: ingList.find((i) => i.id === s.skladnik_id)?.nazwa ?? '',
              qty: String(s.qty),
              unit: s.unit_meas
            })
          )
        );
      }
      setDictLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [initial]);

  // Zamknięcie klawiszem Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ingredientByName = useMemo(() => {
    const map = new Map<string, Ingredient>();
    for (const i of ingredients) map.set(i.nazwa.trim().toLowerCase(), i);
    return map;
  }, [ingredients]);

  const updateRow = (key: number, patch: Partial<IngredientRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        // Po wyborze składnika z listy podpowiadamy jego domyślną jednostkę
        if (patch.name !== undefined) {
          const match = ingredientByName.get(patch.name.trim().toLowerCase());
          if (match?.domyslna_jednostka && isValidUnit(match.domyslna_jednostka)) {
            next.unit = match.domyslna_jednostka;
          }
        }
        return next;
      })
    );
    setErrors((prev) => ({ ...prev, skladniki: undefined, rows: undefined }));
    setSubmitError(null);
  };

  const toggleEquipment = (id: number) =>
    setSelectedEquipment((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const validate = () => {
    const e: FormErrors = {};
    const name = nazwa.trim();
    if (!name) e.nazwa = 'Podaj nazwę przepisu.';
    else if (name.length > 100) e.nazwa = 'Nazwa może mieć najwyżej 100 znaków.';

    const c = toInt(czas);
    if (!(c > 0)) e.czas = 'Czas to liczba całkowita minut > 0.';
    const p = toInt(porcja);
    if (!(p > 0)) e.porcja = 'Liczba porcji musi być > 0.';
    if (!trudnosc) e.trudnosc = 'Wybierz trudność.';
    if (kalorycznosc.trim() !== '') {
      const k = toInt(kalorycznosc);
      if (!(k >= 0)) e.kalorycznosc = 'Liczba całkowita ≥ 0.';
    }

    const filled = rows.filter((r) => r.name.trim() || r.qty.trim());
    const rowErrors: Record<number, string> = {};
    const usedIds = new Set<number>();
    for (const r of filled) {
      const match = ingredientByName.get(r.name.trim().toLowerCase());
      const qty = toQty(r.qty);
      if (!match) rowErrors[r.key] = 'Wybierz składnik z listy.';
      else if (usedIds.has(match.id)) rowErrors[r.key] = 'Ten składnik jest już na liście.';
      else if (!Number.isFinite(qty) || qty <= 0) rowErrors[r.key] = 'Podaj ilość > 0.';
      else if (!isValidUnit(r.unit)) rowErrors[r.key] = 'Wybierz jednostkę.';
      if (match) usedIds.add(match.id);
    }
    if (filled.length === 0) e.skladniki = 'Dodaj przynajmniej jeden składnik.';
    if (Object.keys(rowErrors).length) e.rows = rowErrors;

    return e;
  };

  const buildPayload = () => ({
    nazwa: nazwa.trim(),
    czas: toInt(czas),
    trudnosc,
    kalorycznosc: kalorycznosc.trim() === '' ? 0 : toInt(kalorycznosc),
    porcja: toInt(porcja),
    opis: joinDescription(description, steps),
    sprzet: selectedEquipment,
    sprzet_alternatywny: [] as number[],
    skladniki: rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        skladnik_id: ingredientByName.get(r.name.trim().toLowerCase())!.id,
        qty: toQty(r.qty),
        unit_meas: r.unit
      }))
  });

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const payload = buildPayload();

    if (demoMode) {
      setDemoPayload(JSON.stringify(payload, null, 2));
      return;
    }

    setIsSaving(true);
    setSubmitError(null);
    try {
      if (isEditing) {
        await apiFetch(`/przepisy/${initial.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/przepisy', { method: 'POST', body: JSON.stringify(payload) });
      }
      onSaved(isEditing ? 'Zapisano zmiany w przepisie.' : 'Dodano przepis.');
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.status === 404
            ? 'Ta operacja nie jest jeszcze dostępna na serwerze.'
            : err.message
          : 'Nie udało się zapisać przepisu.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-form-title"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <h3 id="recipe-form-title" className="text-lg font-bold text-white">
            {isEditing ? 'Edytuj przepis' : 'Dodaj nowy przepis'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Zamknij">
            <X className="w-5 h-5" />
          </button>
        </div>

        {demoMode && !dictLoading && (
          <div className="mb-5 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-100 flex gap-2">
            <FlaskConical className="w-4 h-4 text-sky-300 shrink-0" />
            <span>
              <strong>Tryb demo</strong> – brak słowników z API (<code>/skladniki</code>,{' '}
              <code>/sprzet</code>). Używam przykładowych list, a przepis nie zostanie zapisany w
              bazie – zobaczysz dane, które poszłyby do serwera.
            </span>
          </div>
        )}

        {demoPayload ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Formularz poprawny. Tak wyglądałoby zapytanie <code>POST /api/przepisy</code>:
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 overflow-x-auto">
              {demoPayload}
            </pre>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDemoPayload(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-white transition"
              >
                Wróć do formularza
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 transition"
              >
                Zamknij
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Nazwa */}
            <div className="space-y-1">
              <label htmlFor="recipe-name" className="text-xs font-medium text-slate-400">
                Nazwa przepisu *
              </label>
              <input
                id="recipe-name"
                type="text"
                autoFocus
                maxLength={100}
                value={nazwa}
                onChange={(e) => {
                  setNazwa(e.target.value);
                  setErrors((p) => ({ ...p, nazwa: undefined }));
                }}
                placeholder="np. Spaghetti z pomidorami i czosnkiem"
                aria-invalid={Boolean(errors.nazwa)}
                className={inputClass(Boolean(errors.nazwa))}
              />
              {errors.nazwa && <p className="text-xs text-rose-400">{errors.nazwa}</p>}
            </div>

            {/* Parametry */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label htmlFor="recipe-time" className="text-xs font-medium text-slate-400">
                  Czas (min) *
                </label>
                <input
                  id="recipe-time"
                  type="number"
                  min="1"
                  step="1"
                  value={czas}
                  onChange={(e) => {
                    setCzas(e.target.value);
                    setErrors((p) => ({ ...p, czas: undefined }));
                  }}
                  aria-invalid={Boolean(errors.czas)}
                  className={inputClass(Boolean(errors.czas))}
                />
                {errors.czas && <p className="text-xs text-rose-400">{errors.czas}</p>}
              </div>
              <div className="space-y-1">
                <label htmlFor="recipe-servings" className="text-xs font-medium text-slate-400">
                  Porcje *
                </label>
                <input
                  id="recipe-servings"
                  type="number"
                  min="1"
                  step="1"
                  value={porcja}
                  onChange={(e) => {
                    setPorcja(e.target.value);
                    setErrors((p) => ({ ...p, porcja: undefined }));
                  }}
                  aria-invalid={Boolean(errors.porcja)}
                  className={inputClass(Boolean(errors.porcja))}
                />
                {errors.porcja && <p className="text-xs text-rose-400">{errors.porcja}</p>}
              </div>
              <div className="space-y-1">
                <label htmlFor="recipe-difficulty" className="text-xs font-medium text-slate-400">
                  Trudność *
                </label>
                <select
                  id="recipe-difficulty"
                  value={trudnosc}
                  onChange={(e) => setTrudnosc(e.target.value as Difficulty)}
                  className={inputClass(Boolean(errors.trudnosc))}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="recipe-kcal" className="text-xs font-medium text-slate-400">
                  Kcal / porcja
                </label>
                <input
                  id="recipe-kcal"
                  type="number"
                  min="0"
                  step="1"
                  value={kalorycznosc}
                  onChange={(e) => {
                    setKalorycznosc(e.target.value);
                    setErrors((p) => ({ ...p, kalorycznosc: undefined }));
                  }}
                  placeholder="Opcjonalnie"
                  aria-invalid={Boolean(errors.kalorycznosc)}
                  className={inputClass(Boolean(errors.kalorycznosc))}
                />
                {errors.kalorycznosc && (
                  <p className="text-xs text-rose-400">{errors.kalorycznosc}</p>
                )}
              </div>
            </div>

            {/* Składniki */}
            <fieldset className="space-y-2">
              <div className="flex items-center justify-between">
                <legend className="text-xs font-medium text-slate-400">Składniki *</legend>
                <button
                  type="button"
                  onClick={() => setRows((prev) => [...prev, newRow()])}
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Dodaj składnik
                </button>
              </div>

              <datalist id="recipe-ingredients-list">
                {ingredients.map((i) => (
                  <option key={i.id} value={i.nazwa} />
                ))}
              </datalist>

              {dictLoading ? (
                <div className="h-10 rounded-xl bg-slate-950 border border-slate-800 animate-pulse" />
              ) : (
                <div className="space-y-2">
                  {rows.map((row, idx) => {
                    const rowError = errors.rows?.[row.key];
                    return (
                      <div key={row.key} className="space-y-1">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <input
                            type="text"
                            list="recipe-ingredients-list"
                            placeholder="Zacznij pisać, np. Pomidory"
                            aria-label={`Składnik ${idx + 1}`}
                            value={row.name}
                            onChange={(e) => updateRow(row.key, { name: e.target.value })}
                            className={`col-span-12 sm:col-span-6 ${inputClass(Boolean(rowError))}`}
                          />
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Ilość"
                            aria-label={`Ilość składnika ${idx + 1}`}
                            value={row.qty}
                            onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                            className={`col-span-5 sm:col-span-3 ${inputClass(Boolean(rowError))}`}
                          />
                          <select
                            aria-label={`Jednostka składnika ${idx + 1}`}
                            value={row.unit}
                            onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                            className={`col-span-5 sm:col-span-2 ${inputClass()}`}
                          >
                            {UNITS.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setRows((prev) =>
                                prev.length === 1 ? [newRow()] : prev.filter((r) => r.key !== row.key)
                              )
                            }
                            className="col-span-2 sm:col-span-1 text-slate-500 hover:text-rose-400 flex justify-center"
                            aria-label={`Usuń składnik ${idx + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {rowError && <p className="text-xs text-rose-400">{rowError}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              {errors.skladniki && <p className="text-xs text-rose-400">{errors.skladniki}</p>}
            </fieldset>

            {/* Sprzęt */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-slate-400">Wymagany sprzęt</legend>
              {equipment.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {dictLoading ? 'Wczytywanie…' : 'Brak sprzętu w bazie – dodaj go na stronie Wyposażenie.'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {equipment.map((eq) => {
                    const active = selectedEquipment.includes(eq.id);
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleEquipment(eq.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {eq.nazwa}
                        {eq.sprawny === false && ' (w naprawie)'}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            {/* Opis */}
            <div className="space-y-1">
              <label htmlFor="recipe-desc" className="text-xs font-medium text-slate-400">
                Krótki opis
              </label>
              <textarea
                id="recipe-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="np. Szybki obiad z tego, co zwykle jest w kuchni."
                className={inputClass()}
              />
            </div>

            {/* Kroki */}
            <fieldset className="space-y-2">
              <div className="flex items-center justify-between">
                <legend className="text-xs font-medium text-slate-400">Kroki przygotowania</legend>
                <button
                  type="button"
                  onClick={() => setSteps((prev) => [...prev, ''])}
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Dodaj krok
                </button>
              </div>
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <span className="text-xs text-slate-500 w-5 shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    aria-label={`Krok ${idx + 1}`}
                    placeholder={`Opisz krok ${idx + 1}…`}
                    value={step}
                    onChange={(e) =>
                      setSteps((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))
                    }
                    className={inputClass()}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSteps((prev) => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== idx)))
                    }
                    className="text-slate-500 hover:text-rose-400 p-1"
                    aria-label={`Usuń krok ${idx + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </fieldset>

            {submitError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200"
              >
                {submitError}
              </div>
            )}

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-white transition"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={isSaving || dictLoading}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 transition inline-flex items-center gap-2 disabled:opacity-60"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isEditing ? 'Zapisz zmiany' : 'Zapisz przepis'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
