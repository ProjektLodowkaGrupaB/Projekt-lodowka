import { useState, useEffect, useCallback, useMemo, type MouseEvent } from 'react';
import {
  Heart,
  Utensils,
  Search,
  Clock,
  Flame,
  Users,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  X,
  RefreshCw,
  WifiOff,
  ChefHat,
  Minus,
  Plus,
  ArrowRight
} from 'lucide-react';

// ==========================================
// KONFIGURACJA WARSTWY KOMUNIKACJI HTTP/JSON
// ==========================================
const API_BASE_URL = 'http://localhost:5000/api';

export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
  kcalPer100g?: number;
}

export interface FavoriteRecipe {
  id: number | string;
  title: string;
  description?: string;
  prepTime: number;
  servings: number;
  kcalPerServing?: number;
  isFavorite: boolean;
  missingPercentage: number;
  missingIngredients?: string[];
  dietTags?: string[];
  requiredEquipment?: string[];
  ingredients: RecipeIngredient[];
  instructions: string[];
}

export default function FavoritesPage() {
  // Stany danych pobieranych z bazy danych (MySQL / PostgreSQL)
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stany wyszukiwania i filtrowania lokalnego
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matchFilter, setMatchFilter] = useState<'all' | '100' | '75'>('all');

  // Stany szczegółowego podglądu przepisu i skalowania porcji
  const [activeRecipe, setActiveRecipe] = useState<FavoriteRecipe | null>(null);
  const [scaledServings, setScaledServings] = useState<number>(2);
  const [isCooking, setIsCooking] = useState<boolean>(false);

  // Pobieranie ulubionych przepisów z backendu Node.js
  const loadFavorites = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/recipes?favorite=true`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const list = Array.isArray(data)
        ? data.filter((r: FavoriteRecipe) => Boolean(r.isFavorite))
        : [];

      setFavorites(list);
      setDbConnected(true);
    } catch (err: unknown) {
      setDbConnected(false);
      setFavorites([]);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Brak połączenia z serwerem REST API (Node.js / MySQL / PostgreSQL).'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Usuwanie przepisu z listy ulubionych (PATCH /api/recipes/:id/favorite)
  const handleRemoveFromFavorites = async (recipe: FavoriteRecipe, e: MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await fetch(`${API_BASE_URL}/recipes/${recipe.id}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: false })
      });

      if (!response.ok) throw new Error('Błąd aktualizacji ulubionych');

      setFavorites((prev) => prev.filter((item) => item.id !== recipe.id));
      if (activeRecipe?.id === recipe.id) {
        setActiveRecipe(null);
      }
    } catch {
      alert('Nie udało się usunąć przepisu z ulubionych (sprawdź połączenie z API).');
    }
  };

  // Otwieranie szczegółów przepisu z domyślną liczbą porcji
  const openRecipeDetails = (recipe: FavoriteRecipe) => {
    setActiveRecipe(recipe);
    setScaledServings(recipe.servings || 2);
  };

  // Automatyczne usuwanie składników ze spiżarni po wykonaniu przepisu
  const handleCookRecipe = async () => {
    if (!activeRecipe) return;
    setIsCooking(true);

    try {
      const scaleFactor = scaledServings / (activeRecipe.servings || 1);
      const response = await fetch(`${API_BASE_URL}/recipes/${activeRecipe.id}/cook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servingsCooked: scaledServings,
          scaleFactor
        })
      });

      if (!response.ok) throw new Error('Błąd aktualizacji stanu spiżarni');

      alert('Przepis wykonany! Odpowiednia ilość produktów została usunięta ze spiżarni.');
      setActiveRecipe(null);
      await loadFavorites();
    } catch {
      alert('Nie udało się zaktualizować stanu spiżarni. Upewnij się, że backend działa.');
    } finally {
      setIsCooking(false);
    }
  };

  // Filtrowanie ulubionych przepisów po nazwie oraz dostępności składników
  const filteredFavorites = useMemo(() => {
    return favorites.filter((recipe) => {
      if (
        searchQuery.trim() &&
        !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      const missing = recipe.missingPercentage ?? 0;
      if (matchFilter === '100' && missing !== 0) return false;
      if (matchFilter === '75' && (missing === 0 || missing > 25)) return false;

      return true;
    });
  }, [favorites, searchQuery, matchFilter]);

  return (
    <main className="p-8 space-y-8">
      {/* Nagłówek podstrony ulubionych przepisów */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Heart className="w-6 h-6 text-rose-400 fill-rose-400/20" />
            Ulubione przepisy
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Szybki dostęp do zapisanych przepisów wraz z podglądem dostępności składników w spiżarni.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadFavorites}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
          <a
            href="/przepisy"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition"
          >
            <Utensils className="w-4 h-4" />
            Przeglądaj wszystkie przepisy
          </a>
        </div>
      </header>

      {/* Komunikat o braku połączenia z backendem REST API */}
      {!dbConnected && errorMessage && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-300">
                Brak połączenia z warstwą bazy danych
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={loadFavorites}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition shrink-0"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {/* Pasek wyszukiwania i filtrowania po stanie spiżarni */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Wyszukaj wśród ulubionych przepisów..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs shrink-0">
          <button
            onClick={() => setMatchFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
              matchFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Wszystkie ({favorites.length})
          </button>
          <button
            onClick={() => setMatchFilter('100')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
              matchFilter === '100'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            100% składników
          </button>
          <button
            onClick={() => setMatchFilter('75')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
              matchFilter === '75'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Braki ≤ 25%
          </button>
        </div>
      </section>

      {/* Lista ulubionych przepisów lub pusty stan */}
      {filteredFavorites.length === 0 ? (
        <div className="py-16 px-4 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
          <Heart className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-300">
              Brak zapisanych ulubionych przepisów
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {dbConnected
                ? 'Oznacz wybrane dania ikoną serca na podstronie przepisów, aby mieć do nich szybki dostęp w tym miejscu.'
                : 'Po uruchomieniu backendu i bazy danych zobaczysz tutaj przepisy zapisane jako ulubione.'}
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/przepisy"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              Przejdź do bazy przepisów
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredFavorites.map((recipe) => {
            const missing = recipe.missingPercentage ?? 0;
            const isFullMatch = missing === 0;
            const isPartialMatch = missing > 0 && missing <= 25;

            return (
              <div
                key={recipe.id}
                onClick={() => openRecipeDetails(recipe)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between gap-4 cursor-pointer transition group"
              >
                <div className="space-y-3">
                  {/* Pasek statusu dopasowania i przycisk usunięcia z ulubionych */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                        isFullMatch
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : isPartialMatch
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {isFullMatch
                        ? '100% składników'
                        : `Brakuje ${missing}% składników`}
                    </span>

                    <button
                      onClick={(e) => handleRemoveFromFavorites(recipe, e)}
                      className="p-1.5 rounded-lg text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition"
                      title="Usuń z ulubionych"
                    >
                      <Heart className="w-4 h-4 fill-rose-400" />
                    </button>
                  </div>

                  {/* Tytuł i opis */}
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">
                      {recipe.title}
                    </h3>
                    {recipe.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {recipe.description}
                      </p>
                    )}
                  </div>

                  {/* Tagi dietetyczne */}
                  {recipe.dietTags && recipe.dietTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recipe.dietTags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 border border-slate-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Wizualizacja brakujących produktów (gdy brakuje <= 25%) */}
                  {isPartialMatch &&
                    recipe.missingIngredients &&
                    recipe.missingIngredients.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                        <p className="text-[11px] font-medium text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Brakujące produkty (≤ 25%):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {recipe.missingIngredients.map((item, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-200"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {/* Stopka karty: czas, porcje, kalorie */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    {recipe.prepTime} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    {recipe.servings} porcje
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    {recipe.kcalPerServing ? `${recipe.kcalPerServing} kcal` : '— kcal'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL SZCZEGÓŁOWEGO PODGLĄDU PRZEPISU I SKALOWANIA PORCJI */}
      {/* ========================================================= */}
      {activeRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">{activeRecipe.title}</h3>
                {activeRecipe.description && (
                  <p className="text-sm text-slate-400 mt-1">{activeRecipe.description}</p>
                )}
              </div>
              <button
                onClick={() => setActiveRecipe(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pasek skalowania porcji oraz przelicznik kalorii */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-xs text-slate-400">Skalowanie przepisu</p>
                  <p className="text-sm font-semibold text-white">
                    Ilość przygotowywanych porcji:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1">
                  <button
                    onClick={() => setScaledServings((s) => Math.max(1, s - 1))}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center font-bold text-white">
                    {scaledServings}
                  </span>
                  <button
                    onClick={() => setScaledServings((s) => s + 1)}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-right">
                  <p className="text-xs text-slate-400">Kaloryczność całkowita</p>
                  <p className="text-sm font-bold text-orange-400">
                    {activeRecipe.kcalPerServing
                      ? `${activeRecipe.kcalPerServing * scaledServings} kcal (${activeRecipe.kcalPerServing} kcal/porcja)`
                      : 'Brak danych kcal'}
                  </p>
                </div>
              </div>
            </div>

            {/* Lista przeskalowanych składników i instrukcje */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Wymagane składniki ({scaledServings} porcji)
                </h4>
                <ul className="space-y-2">
                  {activeRecipe.ingredients.map((ing, idx) => {
                    const scale = scaledServings / (activeRecipe.servings || 1);
                    const scaledAmount = Math.round(ing.amount * scale * 10) / 10;
                    return (
                      <li
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-200">{ing.name}</span>
                        <span className="font-semibold text-emerald-400">
                          {scaledAmount} {ing.unit}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {activeRecipe.requiredEquipment &&
                  activeRecipe.requiredEquipment.length > 0 && (
                    <div className="pt-3">
                      <h5 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-purple-400" />
                        Wymagane wyposażenie kuchni:
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {activeRecipe.requiredEquipment.map((eq, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300"
                          >
                            {eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Instrukcja przygotowania
                </h4>
                <ol className="space-y-3">
                  {activeRecipe.instructions.map((step, idx) => (
                    <li
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-300 flex gap-3"
                    >
                      <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Przycisk zakończenia gotowania i automatycznego odjęcia produktów ze spiżarni */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Po kliknięciu „Ugotowano” odpowiednia ilość składników zostanie odjęta ze spiżarni.
              </p>
              <button
                onClick={handleCookRecipe}
                disabled={isCooking}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition disabled:opacity-50"
              >
                <ChefHat className="w-4 h-4" />
                {isCooking ? 'Aktualizowanie spiżarni...' : 'Ugotowano! Odejmij składniki'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}