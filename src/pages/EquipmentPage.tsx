import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit2,
  Trash2,
  RefreshCw,
  WifiOff,
  X,
  Check,
  Settings2
} from 'lucide-react';

// ==========================================
// KONFIGURACJA WARSTWY KOMUNIKACJI HTTP/JSON
// ==========================================
import { API_BASE_URL } from '../api';

export type EquipmentStatus = 'gotowy' | 'w naprawie' | 'niedostępny';

export interface EquipmentItem {
  id: number | string;
  name: string;
  category: string;
  status: EquipmentStatus;
  notes?: string;
}

const EQUIPMENT_CATEGORIES = [
  'AGD duże',
  'AGD małe',
  'Garnki i patelnie',
  'Naczynia do pieczenia',
  'Akcesoria kuchenne'
];

export default function EquipmentPage() {
  // Stany danych pobieranych z bazy danych (MySQL / PostgreSQL)
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stany wyszukiwania i filtrowania lokalnego
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | EquipmentStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Stany modalu dodawania i edycji wyposażenia
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    category: string;
    status: EquipmentStatus;
    notes: string;
  }>({
    name: '',
    category: 'AGD małe',
    status: 'gotowy',
    notes: ''
  });

  // Pobieranie listy wyposażenia z backendu Node.js
  const loadEquipmentData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/equipment`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setEquipmentList(Array.isArray(data) ? data : []);
      setDbConnected(true);
    } catch (err: unknown) {
      setDbConnected(false);
      setEquipmentList([]);
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
    loadEquipmentData();
  }, [loadEquipmentData]);

  // Podsumowanie stanu wyposażenia kuchni
  const stats = useMemo(() => {
    const readyCount = equipmentList.filter((item) => item.status === 'gotowy').length;
    const repairCount = equipmentList.filter((item) => item.status === 'w naprawie').length;
    const unavailableCount = equipmentList.filter(
      (item) => item.status === 'niedostępny'
    ).length;

    return {
      total: equipmentList.length,
      readyCount,
      repairCount,
      unavailableCount
    };
  }, [equipmentList]);

  // Filtrowanie sprzętu po nazwie, statusie oraz kategorii
  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((item) => {
      if (
        searchQuery.trim() &&
        !item.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [equipmentList, searchQuery, statusFilter, categoryFilter]);

  // Otwieranie i zamykanie modalu formularza
  const openModal = (item?: EquipmentItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category || 'AGD małe',
        status: item.status || 'gotowy',
        notes: item.notes || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        category: 'AGD małe',
        status: 'gotowy',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // Zapis nowego lub edytowanego wyposażenia w bazie danych (POST / PUT)
  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const isEditing = Boolean(editingItem);
    const url = isEditing
      ? `${API_BASE_URL}/equipment/${editingItem?.id}`
      : `${API_BASE_URL}/equipment`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Błąd zapisu wyposażenia');

      await loadEquipmentData();
      closeModal();
    } catch {
      alert('Nie udało się zapisać wyposażenia w bazie danych.');
    }
  };

  // Szybka zmiana samego statusu urządzenia bezpośrednio z karty (PATCH / PUT)
  const handleQuickStatusChange = async (
    item: EquipmentItem,
    newStatus: EquipmentStatus
  ) => {
    if (item.status === newStatus) return;

    try {
      const response = await fetch(`${API_BASE_URL}/equipment/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, status: newStatus })
      });

      if (!response.ok) throw new Error('Błąd aktualizacji statusu');

      setEquipmentList((prev) =>
        prev.map((eq) => (eq.id === item.id ? { ...eq, status: newStatus } : eq))
      );
    } catch {
      alert('Nie udało się zmienić statusu sprzętu (sprawdź połączenie z API).');
    }
  };

  // Usuwanie sprzętu z bazy danych (DELETE)
  const handleDeleteEquipment = async (id: number | string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć to wyposażenie z kuchni?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/equipment/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Błąd usuwania wyposażenia');

      setEquipmentList((prev) => prev.filter((item) => item.id !== id));
    } catch {
      alert('Nie udało się usunąć wyposażenia z bazy danych.');
    }
  };

  return (
    <main className="p-8 space-y-8">
      {/* Nagłówek podstrony wyposażenia kuchni */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-emerald-400" />
            Wyposażenie kuchni
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Zarządzaj posiadanym sprzętem kuchennym i oznaczaj jego dostępność (gotowy, w naprawie, niedostępny).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadEquipmentData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition"
          >
            <Plus className="w-4 h-4" />
            Dodaj sprzęt
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
                Brak połączenia z warstwą bazy danych
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={loadEquipmentData}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition shrink-0"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {/* Karty podsumowujące stan sprzętu */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">Wszystkie sprzęty</span>
            <p className="text-2xl font-bold text-white mt-1">
              {dbConnected ? stats.total : '—'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
            <Settings2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">Gotowe do użycia</span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {dbConnected ? stats.readyCount : '—'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">
              W naprawie / Niedostępne
            </span>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {dbConnected ? stats.repairCount + stats.unavailableCount : '—'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Pasek wyszukiwania i filtrów statusu oraz kategorii */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Wyszukaj sprzęt kuchenny (np. Piekarnik, Blender)..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Wszystkie kategorie</option>
          {EQUIPMENT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Wszystkie
          </button>
          <button
            onClick={() => setStatusFilter('gotowy')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'gotowy'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Gotowy
          </button>
          <button
            onClick={() => setStatusFilter('w naprawie')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'w naprawie'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            W naprawie
          </button>
          <button
            onClick={() => setStatusFilter('niedostępny')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              statusFilter === 'niedostępny'
                ? 'bg-rose-500/20 text-rose-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Niedostępny
          </button>
        </div>
      </section>

      {/* Lista wyposażenia kuchni lub pusty stan */}
      {filteredEquipment.length === 0 ? (
        <div className="py-16 px-4 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
          <Wrench className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-300">
              Brak wyposażenia do wyświetlenia
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {dbConnected
                ? 'Dodaj posiadane urządzenia kuchenne, aby aplikacja mogła uwzględniać je przy dobieraniu przepisów.'
                : 'Po uruchomieniu backendu i bazy danych zobaczysz tutaj listę wyposażenia swojej kuchni.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => openModal()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition"
            >
              <Plus className="w-4 h-4" />
              Dodaj pierwsze urządzenie
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEquipment.map((item) => {
            const isReady = item.status === 'gotowy';
            const isRepair = item.status === 'w naprawie';

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-medium text-slate-400">
                        {item.category}
                      </span>
                      <h3 className="text-base font-bold text-white mt-0.5">
                        {item.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openModal(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Edytuj sprzęt"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEquipment(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Usuń sprzęt"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Szybki przełącznik stanu sprzętu (Gotowy / W naprawie / Niedostępny) */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Aktualny stan:</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isReady
                          ? 'text-emerald-400'
                          : isRepair
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {isReady ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : isRepair ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {item.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                    <button
                      onClick={() => handleQuickStatusChange(item, 'gotowy')}
                      className={`py-1.5 rounded-lg font-medium transition ${
                        item.status === 'gotowy'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Gotowy
                    </button>
                    <button
                      onClick={() => handleQuickStatusChange(item, 'w naprawie')}
                      className={`py-1.5 rounded-lg font-medium transition ${
                        item.status === 'w naprawie'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      W naprawie
                    </button>
                    <button
                      onClick={() => handleQuickStatusChange(item, 'niedostępny')}
                      className={`py-1.5 rounded-lg font-medium transition ${
                        item.status === 'niedostępny'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Niedostępny
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DODAWANIA I EDYTOWANIA WYPOSAŻENIA KUCHNI           */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editingItem ? 'Edytuj wyposażenie' : 'Dodaj wyposażenie kuchni'}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEquipment} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Nazwa urządzenia / wyposażenia *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="np. Piekarnik parowy, Blender kielichowy, Patelnia żeliwna"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Kategoria</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {EQUIPMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Stan sprzętu</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as EquipmentStatus
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="gotowy">Gotowy</option>
                    <option value="w naprawie">W naprawie</option>
                    <option value="niedostępny">Niedostępny</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Dodatkowe informacje / notatka (opcjonalnie)
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="np. Wymaga wymiany uszczelki, pojemność 2.5L..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-white transition"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 transition flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Zapisz sprzęt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}