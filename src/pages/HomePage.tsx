// import React
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Utensils,
  Package,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Camera,
  Plus,
  RefreshCw,
  ArrowRight,
  Flame,
  Search,
  WifiOff,
  ChevronRight,
  CalendarClock
} from 'lucide-react';

// SERWER

const API_BASE_URL = 'http://localhost:5000/api';

export interface PantryItem {
  id: number | string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  expiryDate?: string | null;
  kcalPer100g?: number;
}

export interface Recipe {
  id: number | string;
  title: string;
  prepTime?: number;
  kcalPerServing?: number;
  servings?: number;
  isFavorite?: boolean;
  missingPercentage: number;
  missingIngredients?: string[];
  dietTags?: string[];
}

export interface EquipmentItem {
  id: number | string;
  name: string;
  category?: string;
  status: string;
}

export interface AIRecommendation {
  id: number | string;
  title: string;
  reason?: string;
  prepTime?: number;
  kcalPerServing?: number;
}

export default function HomePage() {
  // Stany danych pobieranych z bazy
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);

  // Stany komunikacji sieciowej
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stany filtrów lokalnych widoku głównego
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matchFilter, setMatchFilter] = useState<'all' | '100' | '75'>('all');

  // Pomocnicza funkcja zapytania HTTP/JSON
  const fetchJson = async <T,>(endpoint: string, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Nieprawidłowy format odpowiedzi serwera (oczekiwano JSON)');
    }

    return response.json() as Promise<T>;
  };

  // Pobieranie z backendu Node.js
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const [pantryData, recipesData, equipmentData, aiData] = await Promise.all([
        fetchJson<PantryItem[]>('/pantry', controller.signal),
        fetchJson<Recipe[]>('/recipes/matching', controller.signal),
        fetchJson<EquipmentItem[]>('/equipment', controller.signal),
        fetchJson<AIRecommendation[]>('/ai/recommendations', controller.signal)
      ]);

      setPantryItems(Array.isArray(pantryData) ? pantryData : []);
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
      setEquipment(Array.isArray(equipmentData) ? equipmentData : []);
      setAiRecommendations(Array.isArray(aiData) ? aiData : []);
      setDbConnected(true);
    } catch (err: unknown) {
      setDbConnected(false);
      setPantryItems([]);
      setRecipes([]);
      setEquipment([]);
      setAiRecommendations([]);
      setErrorMessage(
        err instanceof Error && err.name !== 'AbortError'
          ? err.message
          : 'Brak odpowiedzi z serwera REST API. Upewnij się, że backend jest uruchomiony.'
      );
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Wyliczenia wskaźników na podstawie danych z bazy
  const stats = useMemo(() => {
    const now = new Date();

    const expiredItems = pantryItems.filter((item) => {
      if (!item.expiryDate) return false;
      return new Date(item.expiryDate).getTime() < now.getTime();
    });

    const expiringSoonItems = pantryItems.filter((item) => {
      if (!item.expiryDate) return false;
      const diffDays =
        (new Date(item.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 3;
    });

    const fullMatchRecipes = recipes.filter(
      (r) => (r.missingPercentage ?? 0) === 0
    );

    const partialMatchRecipes = recipes.filter(
      (r) => (r.missingPercentage ?? 0) > 0 && (r.missingPercentage ?? 0) <= 25
    );

    const readyEquipment = equipment.filter(
      (e) => e.status === 'gotowy' || e.status === 'ready'
    );

    const repairEquipment = equipment.filter(
      (e) => e.status === 'w naprawie' || e.status === 'repair'
    );

    return {
      totalPantry: pantryItems.length,
      expiredCount: expiredItems.length,
      expiringSoonCount: expiringSoonItems.length,
      fullMatchCount: fullMatchRecipes.length,
      partialMatchCount: partialMatchRecipes.length,
      readyEquipmentCount: readyEquipment.length,
      repairEquipmentCount: repairEquipment.length,
    };
  }, [pantryItems, recipes, equipment]);

  // Filtrowanie przepisów dostępnych ze stanu spiżarni i wyposażenia
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const matchesSearch =
        !searchQuery.trim() ||
        recipe.title.toLowerCase().includes(searchQuery.toLowerCase());

      const missing = recipe.missingPercentage ?? 0;
      const matchesLevel =
        matchFilter === 'all'
          ? missing <= 25
          : matchFilter === '100'
          ? missing === 0
          : missing > 0 && missing <= 25;

      return matchesSearch && matchesLevel;
    });
  }, [recipes, searchQuery, matchFilter]);

  // Produkty wymagające uwagi (krótka data ważności lub przeterminowane)
  const urgentPantryItems = useMemo(() => {
    const now = new Date();
    return pantryItems
      .filter((item) => {
        if (!item.expiryDate) return false;
        const diffDays =
          (new Date(item.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 3;
      })
      .sort((a, b) => {
        const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
        const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
        return dateA - dateB;
      });
  }, [pantryItems]);

  return (
    <main className="p-8 space-y-8">
      {/* Nagłówek strony głównej */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Przegląd kuchni i spiżarni
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Zarządzaj zapasami, kontroluj terminy przydatności i wyszukuj przepisy dopasowane do posiadanych składników.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Odśwież dane
          </button>
          <a
            href="/skaner-ai"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-sm font-medium transition"
          >
            <Camera className="w-4 h-4" />
            Dodaj ze zdjęcia AI
          </a>
          <a
            href="/spizarnia?akcja=dodaj"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition"
          >
            <Plus className="w-4 h-4" />
            Dodaj produkt
          </a>
        </div>
      </header>

      {/* Komunikat o braku połączenia z backendem REST API */}
      {errorMessage && (
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
            onClick={loadDashboardData}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition shrink-0"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {/* Karty podsumowujące */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Stan spiżarni</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">
              {dbConnected ? stats.totalPantry : '—'}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Pozycji zapisanych w bazie danych
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Terminy przydatności
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">
              {dbConnected ? stats.expiringSoonCount + stats.expiredCount : '—'}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {dbConnected
                ? `${stats.expiringSoonCount} z krótką datą, ${stats.expiredCount} po terminie`
                : 'Wymagana synchronizacja z bazą'}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Dopasowane przepisy
            </span>
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">
              {dbConnected ? stats.fullMatchCount : '—'}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {dbConnected
                ? `+ ${stats.partialMatchCount} przepisów z brakami do 25%`
                : 'Wymagana synchronizacja z bazą'}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Wyposażenie kuchni
            </span>
            <Wrench className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">
              {dbConnected ? stats.readyEquipmentCount : '—'}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {dbConnected
                ? `Gotowe do pracy (${stats.repairEquipmentCount} w naprawie)`
                : 'Wymagana synchronizacja z bazą'}
            </p>
          </div>
        </div>
      </section>

      {/* Główna siatka 2-kolumnowa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lewa kolumna (2/3): Przepisy dopasowane do stanu spiżarni */}
        <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Przepisy dopasowane do spiżarni
              </h3>
              <p className="text-xs text-slate-400">
                Uwzględnia posiadane składniki, sprawny sprzęt oraz listę braków do 25%
              </p>
            </div>
            <a
              href="/przepisy"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
            >
              Wszystkie przepisy
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Pasek wyszukiwania i filtrów dopasowania */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj dopasowanego przepisu..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                onClick={() => setMatchFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  matchFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Wszystkie
              </button>
              <button
                onClick={() => setMatchFilter('100')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  matchFilter === '100'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                100% składników
              </button>
              <button
                onClick={() => setMatchFilter('75')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  matchFilter === '75'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Braki ≤ 25%
              </button>
            </div>
          </div>

          {/* Lista przepisów lub pusty stan */}
          {filteredRecipes.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <Utensils className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-300">
                  Brak przepisów do wyświetlenia
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {dbConnected
                    ? 'Dodaj produkty do spiżarni lub utwórz nowy przepis w bazie danych, aby zobaczyć propozycje potraw.'
                    : 'Po uruchomieniu backendu i bazy danych w tym miejscu pojawią się przepisy spełniające stan Twojej spiżarni.'}
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <a
                  href="/spizarnia"
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
                >
                  Przejdź do spiżarni
                </a>
                <a
                  href="/przepisy?akcja=nowy"
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-medium text-emerald-300 border border-emerald-500/30 transition"
                >
                  Dodaj przepis
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecipes.map((recipe) => {
                const isFullMatch = (recipe.missingPercentage ?? 0) === 0;
                return (
                  <a
                    key={recipe.id}
                    href={`/przepisy/${recipe.id}`}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-3 group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                            isFullMatch
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isFullMatch
                            ? '100% składników w spiżarni'
                            : `Brakuje ${recipe.missingPercentage}% składników`}
                        </span>
                        {recipe.prepTime && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {recipe.prepTime} min
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-white group-hover:text-emerald-400 transition">
                        {recipe.title}
                      </h4>

                      {!isFullMatch &&
                        recipe.missingIngredients &&
                        recipe.missingIngredients.length > 0 && (
                          <div className="pt-1">
                            <p className="text-[11px] text-slate-400 mb-1">
                              Brakujące produkty:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {recipe.missingIngredients.map((m: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>

                    <div className="pt-3 border-t border-slate-900 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        {recipe.kcalPerServing
                          ? `${recipe.kcalPerServing} kcal / porcja`
                          : 'Brak danych kcal'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        Szczegóły
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Prawa kolumna (1/3): Sugestie AI + Alerty terminów ważności */}
        <div className="space-y-6">
          {/* Rekomendacje AI */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">
                  Sugestie AI dla Ciebie
                </h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Historia wyborów
              </span>
            </div>

            {aiRecommendations.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
                <Sparkles className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-medium text-slate-300">
                  Brak wygenerowanych rekomendacji
                </p>
                <p className="text-[11px] text-slate-500">
                  Moduł AI zasugeruje kolejne posiłki po przeanalizowaniu wcześniej wykonanych przepisów z bazy danych.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {aiRecommendations.map((rec) => (
                  <a
                    key={rec.id}
                    href={`/przepisy/${rec.id}`}
                    className="block p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-white">{rec.title}</h4>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                    {rec.reason && (
                      <p className="text-xs text-slate-400">{rec.reason}</p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* Kontrola dat przydatności do spożycia */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-semibold text-white">
                  Krótkie daty ważności
                </h3>
              </div>
              <a
                href="/spizarnia"
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Pełna lista
              </a>
            </div>

            {urgentPantryItems.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
                <CheckCircle2 className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs font-medium text-slate-300">
                  Brak pilnych alertów
                </p>
                <p className="text-[11px] text-slate-500">
                  {dbConnected
                    ? 'Żaden produkt w spiżarni nie przekroczył terminu przydatności ani nie wygasa w ciągu najbliższych 3 dni.'
                    : 'Po podłączeniu bazy danych zobaczysz tu produkty z krótkim terminem oraz przekreślone produkty przeterminowane.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {urgentPantryItems.map((item) => {
                  const isExpired = item.expiryDate
                    ? new Date(item.expiryDate).getTime() < new Date().getTime()
                    : false;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            isExpired
                              ? 'line-through text-rose-400'
                              : 'text-amber-300'
                          }`}
                        >
                          {item.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {item.quantity} {item.unit} • Ważne do: {item.expiryDate}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isExpired
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isExpired ? 'Przeterminowane' : 'Krótka data'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}