// ==========================================
// TŁUMACZENIE DANYCH API (PL) NA MODEL WIDOKÓW
// ==========================================

export type ApiRecipeIngredient = {
  skladnik_id: number;
  nazwa: string;
  qty: number;
  unit_meas: string;
  w_spizarni?: boolean;
};

export type ApiRecipe = {
  id: number;
  nazwa: string;
  czas: number | null;
  trudnosc: string | null;
  kalorycznosc: number | null;
  porcja: number | null;
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
  skladniki: ApiRecipeIngredient[];
};

export type ApiEquipment = {
  id: number;
  nazwa: string | null;
  sprawny: boolean | null;
  kategoria: string | null;
  status: string;
  notatki: string | null;
};

export type ApiPantryProduct = {
  id: number;
  nazwa: string;
  ilosc: number;
  jednostka: string;
  data_waznosci: string | null;
  kalorie: number | null;
};

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
  isFavorite: boolean;
  missingPercentage: number;
  missingIngredients: string[];
  dietTags: string[];
  allergens: string[];
  requiredEquipment: string[];
  equipmentReady: boolean;
  ingredients: RecipeIngredient[];
  instructions: string[];
  /** Oryginalne dane z API – potrzebne przy edycji przepisu. */
  raw: ApiRecipe;
}

const STEPS_HEADER = 'Przygotowanie:';

/** Baza ma jedno pole opis: kroki są w osobnych liniach, opcjonalnie po nagłówku. */
export const splitRecipeText = (opis: string | null | undefined) => {
  const text = (opis ?? '').trim();
  if (!text) return { description: '', steps: [] as string[] };

  const cleanLines = (value: string) =>
    value
      .split('\n')
      .map((line) => line.replace(/^\s*\d+\.\s*/, '').trim())
      .filter(Boolean);

  const headerIndex = text.indexOf(STEPS_HEADER);
  if (headerIndex !== -1) {
    return {
      description: text.slice(0, headerIndex).trim(),
      steps: cleanLines(text.slice(headerIndex + STEPS_HEADER.length))
    };
  }

  const lines = cleanLines(text);
  return lines.length > 1 ? { description: '', steps: lines } : { description: text, steps: [] };
};

export const joinRecipeText = (description: string, steps: string[]) => {
  const cleanSteps = steps.map((step) => step.trim()).filter(Boolean);
  const parts = [description.trim()];

  if (cleanSteps.length > 0) {
    parts.push(
      `${STEPS_HEADER}\n${cleanSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
    );
  }

  return parts.filter(Boolean).join('\n\n') || null;
};

export const fromApiRecipe = (recipe: ApiRecipe): Recipe => {
  const { description, steps } = splitRecipeText(recipe.opis);

  return {
    id: recipe.id,
    title: recipe.nazwa,
    description: description || undefined,
    prepTime: recipe.czas ?? 0,
    servings: recipe.porcja ?? 1,
    kcalPerServing: recipe.kalorycznosc || undefined,
    isFavorite: recipe.ulubione,
    missingPercentage: recipe.procent_brakow,
    missingIngredients: recipe.brakujace,
    dietTags: recipe.diety,
    allergens: recipe.alergeny,
    requiredEquipment: recipe.sprzet_nazwy,
    equipmentReady: recipe.sprzet_gotowy,
    ingredients: recipe.skladniki.map((skladnik) => ({
      name: skladnik.nazwa,
      amount: skladnik.qty,
      unit: skladnik.unit_meas,
      inPantry: skladnik.w_spizarni
    })),
    instructions: steps,
    raw: recipe
  };
};

export const fromApiEquipment = (item: ApiEquipment) => ({
  id: item.id,
  name: item.nazwa ?? '(bez nazwy)',
  category: item.kategoria ?? 'AGD małe',
  status: item.status,
  notes: item.notatki ?? ''
});

export const fromApiPantryProduct = (product: ApiPantryProduct) => ({
  id: product.id,
  name: product.nazwa,
  quantity: product.ilosc,
  unit: product.jednostka,
  expiryDate: product.data_waznosci,
  kcalPer100g: product.kalorie ?? undefined
});
