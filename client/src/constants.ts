/** Jednostki zgodne z typem unit_meas_enum w bazie PostgreSQL. */
export const UNITS = [
  { value: 'szt', label: 'szt.' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'opak.', label: 'opak.' }
] as const;

export const isValidUnit = (value: string) => UNITS.some((u) => u.value === value);

/** Poziomy trudności zgodne z typem difficulty_enum w bazie PostgreSQL. */
export const DIFFICULTIES = ['łatwy', 'średni', 'trudny'] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export const AVAILABLE_DIETS = [
  'Bezmięsne (Wege)',
  'Wegańskie',
  'Bez glutenu',
  'Bez laktozy',
  'Keto'
];

export const AVAILABLE_ALLERGENS = ['Gluten', 'Laktoza', 'Orzechy', 'Jajka', 'Soja'];
