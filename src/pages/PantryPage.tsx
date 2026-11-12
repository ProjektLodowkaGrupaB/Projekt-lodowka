import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Trash2,
  Edit2,
  Camera,
  RefreshCw,
  X,
  Check,
  ServerCrash,
  Barcode
} from 'lucide-react';

// ==========================================
// KONFIGURACJA WARSTWY KOMUNIKACJI HTTP/JSON
// ==========================================
const API_BASE_URL = 'http://localhost:5000/api';

export interface PantryItem {
  id: number | string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  expiryDate?: string | null;
  kcalPer100g?: number;
  barcode?: string;
}

// Interfejs dla odpowiedzi z OpenFoodFacts API
interface OFFProduct {
  product_name?: string;
  code?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
}

export default function PantryPage() {
  // Stany danych pobieranych z bazy danych
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stany wyszukiwania i filtrowania lokalnego
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'expired' | 'short_date'>('all');

  // Stany modalu dodawania/edycji produktu
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);

  // Stany formularza
  const [formData, setFormData] = useState<Partial<PantryItem>>({
    name: '',
    quantity: 1,
    unit: 'szt',
    expiryDate: '',
    kcalPer100g: 0,
    barcode: ''
  });
  const [isSearchingOFF, setIsSearchingOFF] = useState<boolean>(false);

  // Pobieranie rzeczywistych danych z backendu Node.js
  const loadPantryData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/pantry`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setPantryItems(Array.isArray(data) ? data : []);
      setDbConnected(true);
    } catch (err: unknown) {
      setDbConnected(false);
      setPantryItems([]);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Brak połączenia z backendem (Node.js/MySQL). Spróbuj ponownie.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPantryData();
  }, [loadPantryData]);

  // Obsługa API zewnętrznego - OpenFoodFacts (Wyszukiwanie produktu)
  const searchOpenFoodFacts = async () => {
    if (!formData.name && !formData.barcode) return;
    setIsSearchingOFF(true);

    try {
      // Szukanie po kodzie kreskowym lub nazwie
      const query = formData.barcode || formData.name;
      const url = formData.barcode
        ? `https://world.openfoodfacts.org/api/v0/product/${query}.json`
        : `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=1`;

      const response = await fetch(url);
      const data = await response.json();

      let product: OFFProduct | undefined;

      if (formData.barcode && data.product) {
        product = data.product;
      } else if (data.products && data.products.length > 0) {
        product = data.products[0];
      }

      if (product) {
        setFormData((prev) => ({
          ...prev,
          name: product?.product_name || prev.name,
          barcode: product?.code || prev.barcode,
          kcalPer100g: product?.nutriments?.['energy-kcal_100g'] || prev.kcalPer100g
        }));
      } else {
        alert('Nie znaleziono produktu w bazie OpenFoodFacts.');
      }
    } catch (error) {
      console.error('Błąd pobierania danych z OpenFoodFacts', error);
      alert('Wystąpił błąd podczas łączenia z OpenFoodFacts API.');
    } finally {
      setIsSearchingOFF(false);
    }
  };

  // Zapis produktu do bazy danych (POST / PUT)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = Boolean(editingItem);
    const url = isEditing
      ? `${API_BASE_URL}/pantry/${editingItem?.id}`
      : `${API_BASE_URL}/pantry`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Błąd zapisu danych');

      await loadPantryData();
      closeModal();
    } catch {
      alert('Nie udało się zapisać produktu w bazie danych.');
    }
  };

  // Usuwanie produktu z bazy danych (DELETE)
  const handleDeleteProduct = async (id: number | string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten produkt ze spiżarni?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/pantry/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Błąd usuwania');

      setPantryItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      alert('Nie udało się usunąć produktu.');
    }
  };

  // Otwieranie/zamykanie modalu
  const openModal = (item?: PantryItem) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        quantity: 1,
        unit: 'szt',
        expiryDate: '',
        kcalPer100g: 0,
        barcode: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // Filtrowanie i sortowanie listy produktów
  const processedItems = useMemo(() => {
    const nowTimestamp = new Date().getTime();

    return pantryItems
      .filter((item) => {
        // Filtr wyszukiwania tekstowego
        if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }

        // Filtry dat
        if (filterType === 'all') return true;

        const isExpired =
          item.expiryDate && new Date(item.expiryDate).getTime() < nowTimestamp;
        const diffDays = item.expiryDate
          ? (new Date(item.expiryDate).getTime() - nowTimestamp) / (1000 * 60 * 60 * 24)
          : Infinity;
        const isShortDate = diffDays >= 0 && diffDays <= 3;

        if (filterType === 'expired') return isExpired;
        if (filterType === 'short_date') return isShortDate;

        return true;
      })
      .sort((a, b) => {
        // Sortowanie: najpierw przeterminowane, potem krótkie daty, na końcu reszta
        const timeA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
        const timeB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
        return timeA - timeB;
      });
  }, [pantryItems, searchQuery, filterType]);

  return (
    <main className="p-8 space-y-8">
      {/* Nagłówek i akcje */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-emerald-400" />
            Spiżarnia
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Zarządzaj swoimi produktami, kontroluj kalorie i daty ważności (Integracja OpenFoodFacts).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadPantryData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-sm font-medium transition disabled:opacity-50"
            title="Odśwież dane z bazy"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
          <a
            href="/skaner-ai"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-sm font-medium transition"
          >
            <Camera className="w-4 h-4" />
            Skaner AI
          </a>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition"
          >
            <Plus className="w-4 h-4" />
            Dodaj produkt
          </button>
        </div>
      </header>

      {/* Pasek Błędów DB */}
      {!dbConnected && errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3">
          <ServerCrash className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-200">
            {errorMessage} Uruchom serwer REST API.
          </p>
        </div>
      )}

      {/* Filtry i wyszukiwarka */}
      <div className="flex flex-col sm:flex-row gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Wyszukaj produkt w spiżarni..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterType === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Wszystkie
          </button>
          <button
            onClick={() => setFilterType('short_date')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterType === 'short_date'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-amber-300 border border-slate-800'
            }`}
          >
            Krótka data
          </button>
          <button
            onClick={() => setFilterType('expired')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterType === 'expired'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-slate-950 text-slate-400 hover:text-rose-300 border border-slate-800'
            }`}
          >
            Przeterminowane
          </button>
        </div>
      </div>

      {/* Lista produktów */}
      {processedItems.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-slate-900/50 border border-dashed border-slate-800">
          <Package className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-300">Brak produktów</h3>
          <p className="text-sm text-slate-500 mt-1">
            Spiżarnia jest pusta lub żaden produkt nie spełnia kryteriów.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {processedItems.map((item) => {
            const nowTimestamp = new Date().getTime();
            const isExpired = item.expiryDate
              ? new Date(item.expiryDate).getTime() < nowTimestamp
              : false;
            const diffDays = item.expiryDate
              ? (new Date(item.expiryDate).getTime() - nowTimestamp) /
                (1000 * 60 * 60 * 24)
              : Infinity;
            const isShortDate = !isExpired && diffDays <= 3;

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between group transition ${
                  isExpired
                    ? 'bg-rose-950/20 border-rose-900/50'
                    : isShortDate
                    ? 'bg-amber-950/20 border-amber-900/50'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <h4
                      className={`font-semibold truncate pr-2 ${
                        isExpired ? 'text-rose-400 line-through' : 'text-white'
                      }`}
                    >
                      {item.name}
                    </h4>
                    {isExpired && (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    {isShortDate && (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <p className="text-slate-400 flex justify-between">
                      <span>Ilość:</span>
                      <span className="font-medium text-slate-200">
                        {item.quantity} {item.unit}
                      </span>
                    </p>
                    {item.kcalPer100g && (
                      <p className="text-slate-400 flex justify-between">
                        <span>Kalorie:</span>
                        <span className="font-medium text-slate-200">
                          {item.kcalPer100g} kcal/100g
                        </span>
                      </p>
                    )}
                    {item.expiryDate && (
                      <p
                        className={`flex justify-between ${
                          isExpired
                            ? 'text-rose-400'
                            : isShortDate
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        <span>Data ważności:</span>
                        <span className="font-medium">{item.expiryDate}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/50 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openModal(item)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Edytuj produkt"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(item.id)}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                    title="Usuń ze spiżarni"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dodawania / Edycji (Integracja z OpenFoodFacts API) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editingItem ? 'Edytuj produkt' : 'Dodaj do spiżarni'}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
              {/* Integracja OpenFoodFacts */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400">
                  Nazwa produktu lub Kod EAN
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.name || formData.barcode}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Prosta heurystyka: jeśli same cyfry i dł > 7, to prawdopodobnie kod EAN
                      if (/^\d{8,}$/.test(val)) {
                        setFormData({ ...formData, barcode: val, name: '' });
                      } else {
                        setFormData({ ...formData, name: val, barcode: '' });
                      }
                    }}
                    placeholder="np. Mleko 3.2% lub 5901234567890"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={searchOpenFoodFacts}
                    disabled={isSearchingOFF || (!formData.name && !formData.barcode)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-emerald-400 text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSearchingOFF ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Barcode className="w-4 h-4" />
                    )}
                    Szukaj API
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Wpisz nazwę lub kod kreskowy, aby automatycznie pobrać kalorie z OpenFoodFacts.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Ilość</label>
                  <input
                    type="number"
                    required
                    min="0.1"
                    step="0.1"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Jednostka</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="szt">sztuki</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">litry</option>
                    <option value="ml">ml</option>
                    <option value="opak">opakowanie</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">
                    Kalorie (kcal/100g)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.kcalPer100g || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        kcalPer100g: parseFloat(e.target.value)
                      })
                    }
                    placeholder="Opcjonalnie"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">
                    Data ważności
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, expiryDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
                  />
                </div>
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
                  Zapisz produkt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}