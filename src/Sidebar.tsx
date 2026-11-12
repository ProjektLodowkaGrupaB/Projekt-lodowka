import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Utensils,
  Package,
  Refrigerator,
  Heart,
  Wrench,
  Camera,
  Database
} from 'lucide-react';
import { apiFetch } from './api';

type Stats = {
  pantry: number | null;
  recipes: number | null;
  favorites: number | null;
  equipment: number | null;
};

const countOf = (result: PromiseSettledResult<unknown>): number | null =>
  result.status === 'fulfilled' && Array.isArray(result.value) ? result.value.length : null;

export default function Sidebar() {
  const [dbConnected, setDbConnected] = useState(false);
  const [stats, setStats] = useState<Stats>({
    pantry: null,
    recipes: null,
    favorites: null,
    equipment: null
  });

  useEffect(() => {
    // Statystyki pobierane niezależnie – brak jednego endpointu nie psuje pozostałych.
    // Status „Połączono” oznacza, że odpowiada spiżarnia (GET /api/spizarnia).
    let cancelled = false;

    Promise.allSettled([
      apiFetch('/spizarnia'),
      apiFetch('/przepisy'),
      apiFetch('/sprzet')
    ]).then(([pantry, recipes, equipment]) => {
      if (cancelled) return;
      const recipeList =
        recipes.status === 'fulfilled' && Array.isArray(recipes.value) ? recipes.value : null;

      setStats({
        pantry: countOf(pantry),
        recipes: countOf(recipes),
        favorites: recipeList
          ? recipeList.filter((r: { isFavorite?: boolean }) => r.isFavorite).length
          : null,
        equipment: countOf(equipment)
      });
      setDbConnected(pantry.status === 'fulfilled');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const badge = (value: number | null) => (value === null ? '—' : value);

  // Funkcja pomocnicza do aktywnego linku
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between px-3.5 py-2.5 rounded-xl transition text-sm ${
      isActive
        ? 'bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20'
        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 min-h-screen">
      <div>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">SmartPantry</h1>
            <p className="text-xs text-slate-400">Panel Kulinarny AI</p>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          <NavLink to="/" className={navClass}>
            <span className="flex items-center gap-3">
              <Refrigerator className="w-4 h-4" />
              Strona główna
            </span>
          </NavLink>
          <NavLink to="/spizarnia" className={navClass}>
            <span className="flex items-center gap-3">
              <Package className="w-4 h-4" />
              Spiżarnia
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {badge(stats.pantry)}
            </span>
          </NavLink>
          <NavLink to="/przepisy" className={navClass}>
            <span className="flex items-center gap-3">
              <Utensils className="w-4 h-4" />
              Przepisy
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {badge(stats.recipes)}
            </span>
          </NavLink>
          <NavLink to="/ulubione" className={navClass}>
            <span className="flex items-center gap-3">
              <Heart className="w-4 h-4" />
              Ulubione
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {badge(stats.favorites)}
            </span>
          </NavLink>
          <NavLink to="/wyposazenie" className={navClass}>
            <span className="flex items-center gap-3">
              <Wrench className="w-4 h-4" />
              Wyposażenie kuchni
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {badge(stats.equipment)}
            </span>
          </NavLink>
          <NavLink to="/skaner-ai" className={navClass}>
            <span className="flex items-center gap-3">
              <Camera className="w-4 h-4 text-emerald-400" />
              Skaner produktów AI
            </span>
          </NavLink>
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Status API / Bazy
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${dbConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              {dbConnected ? 'Połączono' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}