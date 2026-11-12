import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Utensils,
  Plus,
  Search,
  Filter,
  Clock,
  Flame,
  Users,
  Heart,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  WifiOff,
  ChefHat,
  Minus
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
  inPantry?: boolean;
}

export interface Recipe {
  id: number | string;
  title: string;
  description?: string;
  prepTime: number;
  servings: number;
  kcalPerServing?: number;
  isFavorite?: boolean;
  missingPercentage: number;
  missingIngredients?: string[];
  dietTags?: string[];
  allergens?: string[];
  requiredEquipment?: string[];
  equipmentReady?: boolean;
  ingredients: RecipeIngredient[];
  instructions: string[];
}

interface RecipeFormState {
  title: string;
  description: string;
  prepTime: number;
  servings: number;
  kcalPerServing: number;
  dietTags: string[];
  allergens: string[];
  requiredEquipmentInput: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
}

const AVAILABLE_DIETS = ['Bezmięsne (Wege)', 'Wegańskie', 'Bez glutenu', 'Bez laktozy', 'Keto'];
const AVAILABLE_ALLERGENS = ['Gluten', 'Laktoza', 'Orzechy', 'Jajka', 'Soja'];

export default function RecipesPage() {
  // Stany danych pobieranych z bazy danych (MySQL / PostgreSQL)
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stany wyszukiwania i filtrowania przepisów
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matchFilter, setMatchFilter] = useState<'all' | '100' | '75'>('all');
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);
  const [onlyReadyEquipment, setOnlyReadyEquipment] = useState<boolean>(false);

  // Stany szczegółowego podglądu przepisu i skalowania porcji
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [scaledServings, setScaledServings] = useState<number>(2);
  const [isCooking, setIsCooking] = useState<boolean>(false);

  // Stany formularza dodawania / edycji przepisu
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formData, setFormData] = useState<RecipeFormState>({
    title: '',
    description: '',
    prepTime: 30,
    servings: 2,
    kcalPerServing: 0,
    dietTags: [],
    allergens: [],
    requiredEquipmentInput: '',
    ingredients: [{ name: '', amount: 100, unit: 'g', kcalPer100g: 0 }],
    instructions: ['']
  });

  // Pobieranie przepisów z backendu Node.js
  const loadRecipes = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/recipes`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setRecipes(Array.isArray(data) ? data : []);
      setDbConnected(true);
    } catch (err: unknown) {
      setDbConnected(false);
      setRecipes([]);
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
    loadRecipes();

    // Obsługa parametru URL ?akcja=nowy (np. po kliknięciu z HomePage)
    const params = new URLSearchParams(window.location.search);
    if (params.get('akcja') === 'nowy') {
      openFormModal();
    }
  }, [loadRecipes]);

  // Otwieranie szczegółów przepisu z inicjalizacją domyślnej liczby porcji
  const openRecipeDetails = (recipe: Recipe) => {
    setActiveRecipe(recipe);
    setScaledServings(recipe.servings || 2);
  };

  // Przełączanie ulubionego przepisu w bazie danych
  const handleToggleFavorite = async (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${API_BASE_URL}/recipes/${recipe.id}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !recipe.isFavorite })
      });

      if (!response.ok) throw new Error('Błąd aktualizacji ulubionych');

      setRecipes((prev) =>
        prev.map((r) => (r.id === recipe.id ? { ...r, isFavorite: !r.isFavorite } : r))
      );
      if (activeRecipe && activeRecipe.id === recipe.id) {
        setActiveRecipe({ ...activeRecipe, isFavorite: !activeRecipe.isFavorite });
      }
    } catch {
      alert('Nie udało się zaktualizować listy ulubionych (sprawdź połączenie z API).');
    }
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

      alert('Przepis wykonany! Zużyte składniki zostały automatycznie odjęte ze spiżarni.');
      setActiveRecipe(null);
      await loadRecipes();
    } catch {
      alert('Nie udało się odjąć składników ze spiżarni. Upewnij się, że backend działa.');
    } finally {
      setIsCooking(false);
    }
  };

  // Usuwanie przepisu z bazy danych
  const handleDeleteRecipe = async (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Czy na pewno chcesz usunąć ten przepis z bazy danych?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Błąd usuwania przepisu');

      setRecipes((prev) => prev.filter((r) => r.id !== id));
      if (activeRecipe?.id === id) setActiveRecipe(null);
    } catch {
      alert('Nie udało się usunąć przepisu z bazy danych.');
    }
  };

  // Otwieranie formularza dodawania / edycji przepisu
  const openFormModal = (recipe?: Recipe, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (recipe) {
      setEditingRecipe(recipe);
      setFormData({
        title: recipe.title,
        description: recipe.description || '',
        prepTime: recipe.prepTime || 30,
        servings: recipe.servings || 2,
        kcalPerServing: recipe.kcalPerServing || 0,
        dietTags: recipe.dietTags || [],
        allergens: recipe.allergens || [],
        requiredEquipmentInput: (recipe.requiredEquipment || []).join(', '),
        ingredients:
          recipe.ingredients && recipe.ingredients.length > 0
            ? recipe.ingredients
            : [{ name: '', amount: 100, unit: 'g', kcalPer100g: 0 }],
        instructions:
          recipe.instructions && recipe.instructions.length > 0
            ? recipe.instructions
            : ['']
      });
    } else {
      setEditingRecipe(null);
      setFormData({
        title: '',
        description: '',
        prepTime: 30,
        servings: 2,
        kcalPerServing: 0,
        dietTags: [],
        allergens: [],
        requiredEquipmentInput: '',
        ingredients: [{ name: '', amount: 100, unit: 'g', kcalPer100g: 0 }],
        instructions: ['']
      });
    }
    setIsFormOpen(true);
  };

  // Zapis nowego lub edytowanego przepisu do bazy danych
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanedIngredients = formData.ingredients.filter((i) => i.name.trim() !== '');
    const cleanedInstructions = formData.instructions.filter((s) => s.trim() !== '');

    if (cleanedIngredients.length === 0 || cleanedInstructions.length === 0) {
      alert('Dodaj przynajmniej jeden składnik oraz jeden krok instrukcji.');
      return;
    }

    // Automatyczne wyliczenie kalorii na porcję z podanych składników (jeśli wpisano kcal/100g)
    const calculatedTotalKcal = cleanedIngredients.reduce((acc, ing) => {
      if (!ing.kcalPer100g) return acc;
      const multiplier = ing.unit === 'kg' || ing.unit === 'l' ? (ing.amount * 1000) / 100 : ing.amount / 100;
      return acc + ing.kcalPer100g * multiplier;
    }, 0);

    const finalKcalPerServing =
      formData.kcalPerServing > 0
        ? formData.kcalPerServing
        : Math.round(calculatedTotalKcal / (formData.servings || 1));

    const payload = {
      title: formData.title,
      description: formData.description,
      prepTime: formData.prepTime,
      servings: formData.servings,
      kcalPerServing: finalKcalPerServing,
      dietTags: formData.dietTags,
      allergens: formData.allergens,
      requiredEquipment: formData.requiredEquipmentInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      ingredients: cleanedIngredients,
      instructions: cleanedInstructions
    };

    const isEditing = Boolean(editingRecipe);
    const url = isEditing
      ? `${API_BASE_URL}/recipes/${editingRecipe?.id}`
      : `${API_BASE_URL}/recipes`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Błąd zapisu przepisu');

      setIsFormOpen(false);
      await loadRecipes();
    } catch {
      alert('Nie udało się zapisać przepisu w bazie danych.');
    }
  };

  // Pomocnicze funkcje przełączania filtrów
  const toggleArrayItem = (list: string[], item: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  // Filtrowanie przepisów w oparciu o stan spiżarni, sprzęt i wymagania użytkownika
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      // Wyszukiwanie po nazwie
      if (
        searchQuery.trim() &&
        !recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Filtr dostępności składników (100% lub braki do 25%)
      const missing = recipe.missingPercentage ?? 0;
      if (matchFilter === '100' && missing !== 0) return false;
      if (matchFilter === '75' && (missing === 0 || missing > 25)) return false;

      // Filtr dostępności sprawnego wyposażenia kuchni
      if (onlyReadyEquipment && recipe.equipmentReady === false) {
        return false;
      }

      // Filtr wybranych diet (np. Bezmięsne, Bez glutenu)
      if (selectedDiets.length > 0) {
        const tags = recipe.dietTags || [];
        const hasAllSelectedDiets = selectedDiets.every((d) => tags.includes(d));
        if (!hasAllSelectedDiets) return false;
      }

      // Wykluczanie alergenów podanych przez użytkownika
      if (excludedAllergens.length > 0) {
        const recipeAllergens = recipe.allergens || [];
        const containsForbiddenAllergen = excludedAllergens.some((a) =>
          recipeAllergens.includes(a)
        );
        if (containsForbiddenAllergen) return false;
      }

      return true;
    });
  }, [recipes, searchQuery, matchFilter, onlyReadyEquipment, selectedDiets, excludedAllergens]);

  return (
    <main className="p-8 space-y-8">
      {/* Nagłówek podstrony przepisów */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Utensils className="w-6 h-6 text-emerald-400" />
            Przepisy kulinarne
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Wyszukuj potrawy dopasowane do Twojej spiżarni i wyposażenia, filtruj diety oraz skaluj porcje.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadRecipes}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
          <button
            onClick={() => openFormModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition"
          >
            <Plus className="w-4 h-4" />
            Dodaj przepis
          </button>
        </div>
      </header>

      {/* Komunikat o braku połączenia z backendem REST API */}
      {!dbConnected && errorMessage && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-300">
                Brak połączenia z bazą przepisów
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={loadRecipes}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition shrink-0"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {/* Panel wyszukiwania i zaawansowanych filtrów */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Wyszukiwarka tekstowa */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj przepisu po nazwie..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filtr pokrycia składników ze spiżarni */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs shrink-0">
            <button
              onClick={() => setMatchFilter('all')}
              className={`px-3.5 py-2 rounded-lg font-medium transition ${
                matchFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setMatchFilter('100')}
              className={`px-3.5 py-2 rounded-lg font-medium transition ${
                matchFilter === '100'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Posiadam 100% składników
            </button>
            <button
              onClick={() => setMatchFilter('75')}
              className={`px-3.5 py-2 rounded-lg font-medium transition ${
                matchFilter === '75'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Braki ≤ 25%
            </button>
          </div>

          {/* Filtr sprawnego sprzętu kuchennego */}
          <label className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={onlyReadyEquipment}
              onChange={(e) => setOnlyReadyEquipment(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
            />
            <Wrench className="w-3.5 h-3.5 text-purple-400" />
            Tylko ze sprawnym sprzętem
          </label>
        </div>

        {/* Filtry dietetyczne oraz wykluczanie alergenów */}
        <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              Preferencje dietetyczne:
            </span>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_DIETS.map((diet) => {
                const active = selectedDiets.includes(diet);
                return (
                  <button
                    key={diet}
                    onClick={() => toggleArrayItem(selectedDiets, diet, setSelectedDiets)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {diet}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Wyklucz alergeny:
            </span>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_ALLERGENS.map((allergen) => {
                const excluded = excludedAllergens.includes(allergen);
                return (
                  <button
                    key={allergen}
                    onClick={() =>
                      toggleArrayItem(excludedAllergens, allergen, setExcludedAllergens)
                    }
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
                      excluded
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 line-through'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {allergen}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Lista przepisów lub pusty stan */}
      {filteredRecipes.length === 0 ? (
        <div className="py-16 px-4 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
          <Utensils className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-300">
              Brak przepisów spełniających kryteria
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {dbConnected
                ? 'Zmień filtry wyszukiwania lub dodaj nowy przepis do bazy danych.'
                : 'Po uruchomieniu serwera Node.js i bazy danych zobaczysz tutaj listę przepisów dopasowanych do Twojej spiżarni.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => openFormModal()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition"
            >
              <Plus className="w-4 h-4" />
              Utwórz pierwszy przepis
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => {
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
                  {/* Pasek statusu dopasowania i akcji */}
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

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleToggleFavorite(recipe, e)}
                        className={`p-1.5 rounded-lg transition ${
                          recipe.isFavorite
                            ? 'text-rose-400 bg-rose-500/10'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title="Dodaj do ulubionych"
                      >
                        <Heart
                          className={`w-4 h-4 ${recipe.isFavorite ? 'fill-rose-400' : ''}`}
                        />
                      </button>
                      <button
                        onClick={(e) => openFormModal(recipe, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Edytuj przepis"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteRecipe(recipe.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Usuń przepis"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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

            {/* Lista przeskalowanych składników i instrukcje krok po kroku */}
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

      {/* ========================================================= */}
      {/* MODAL DODAWANIA I EDYTOWANIA PRZEPISU DO BAZY DANYCH       */}
      {/* ========================================================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <h3 className="text-lg font-bold text-white">
                {editingRecipe ? 'Edytuj przepis' : 'Dodaj nowy przepis'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Nazwa przepisu</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="np. Makaron ze szpinakiem i suszonymi pomidorami"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Czas (min)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.prepTime}
                    onChange={(e) =>
                      setFormData({ ...formData, prepTime: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Liczba porcji</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.servings}
                    onChange={(e) =>
                      setFormData({ ...formData, servings: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">
                    Kcal / porcja (opcjonalnie)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.kcalPerServing || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, kcalPerServing: Number(e.target.value) })
                    }
                    placeholder="Wyliczane automatycznie"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Składniki przepisu */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400">
                    Lista składników
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        ingredients: [
                          ...formData.ingredients,
                          { name: '', amount: 100, unit: 'g', kcalPer100g: 0 }
                        ]
                      })
                    }
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    + Dodaj składnik
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.ingredients.map((ing, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        required
                        placeholder="Nazwa składnika"
                        value={ing.name}
                        onChange={(e) => {
                          const updated = [...formData.ingredients];
                          updated[idx].name = e.target.value;
                          setFormData({ ...formData, ingredients: updated });
                        }}
                        className="col-span-5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                      <input
                        type="number"
                        required
                        min="0.1"
                        step="0.1"
                        placeholder="Ilość"
                        value={ing.amount}
                        onChange={(e) => {
                          const updated = [...formData.ingredients];
                          updated[idx].amount = Number(e.target.value);
                          setFormData({ ...formData, ingredients: updated });
                        }}
                        className="col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                      <select
                        value={ing.unit}
                        onChange={(e) => {
                          const updated = [...formData.ingredients];
                          updated[idx].unit = e.target.value;
                          setFormData({ ...formData, ingredients: updated });
                        }}
                        className="col-span-2 px-2 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      >
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="szt">szt</option>
                        <option value="kg">kg</option>
                        <option value="l">l</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        placeholder="kcal/100g"
                        value={ing.kcalPer100g || ''}
                        onChange={(e) => {
                          const updated = [...formData.ingredients];
                          updated[idx].kcalPer100g = Number(e.target.value);
                          setFormData({ ...formData, ingredients: updated });
                        }}
                        className="col-span-2 px-2 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (formData.ingredients.length === 1) return;
                          setFormData({
                            ...formData,
                            ingredients: formData.ingredients.filter((_, i) => i !== idx)
                          });
                        }}
                        className="col-span-1 text-slate-500 hover:text-rose-400 flex justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instrukcje krok po kroku */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400">
                    Kroki przygotowania
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        instructions: [...formData.instructions, '']
                      })
                    }
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    + Dodaj krok
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.instructions.map((step, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-xs text-slate-500 w-5">{idx + 1}.</span>
                      <input
                        type="text"
                        required
                        placeholder={`Opisz krok ${idx + 1}...`}
                        value={step}
                        onChange={(e) => {
                          const updated = [...formData.instructions];
                          updated[idx] = e.target.value;
                          setFormData({ ...formData, instructions: updated });
                        }}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (formData.instructions.length === 1) return;
                          setFormData({
                            ...formData,
                            instructions: formData.instructions.filter((_, i) => i !== idx)
                          });
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wymagany sprzęt kuchenny */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Wymagane wyposażenie (oddzielone przecinkami)
                </label>
                <input
                  type="text"
                  value={formData.requiredEquipmentInput}
                  onChange={(e) =>
                    setFormData({ ...formData, requiredEquipmentInput: e.target.value })
                  }
                  placeholder="np. Piekarnik, Blender, Patelnia"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold text-slate-950 transition"
                >
                  Zapisz przepis w bazie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}