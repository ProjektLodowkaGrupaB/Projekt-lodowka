const recipeRepository = require('../repositories/recipeRepository');
const equipmentRepository = require('../repositories/equipmentRepository');
const { describeRecipe, planConsumption } = require('./recipeLogic');
const { UNITS, DIFFICULTIES, MAX_QTY } = require('../constants');
const { httpError, orNotFound } = require('../utils/http');

const NOT_FOUND = 'Nie znaleziono przepisu.';
const MATCH_LIMIT = 25;

const isPositiveInt = (value) => Number.isInteger(value) && value > 0 && value <= 2147483647;
const isTextList = (value) => Array.isArray(value)
    && value.every((item) => typeof item === 'string' && item.trim());

const validate = (body) => {
    const {
        nazwa,
        czas,
        trudnosc,
        kalorycznosc = 0,
        porcja,
        sprzet = [],
        sprzet_alternatywny = [],
        opis = null,
        diety = [],
        alergeny = [],
        skladniki
    } = body || {};

    if (
        typeof nazwa !== 'string' ||
        !nazwa.trim() ||
        nazwa.trim().length > 100 ||
        !isPositiveInt(czas) ||
        !DIFFICULTIES.includes(trudnosc) ||
        !Number.isInteger(kalorycznosc) ||
        kalorycznosc < 0 ||
        !isPositiveInt(porcja) ||
        !Array.isArray(sprzet) ||
        !Array.isArray(sprzet_alternatywny) ||
        (opis !== null && typeof opis !== 'string') ||
        !isTextList(diety) ||
        !isTextList(alergeny) ||
        !Array.isArray(skladniki) ||
        skladniki.length === 0
    ) {
        throw httpError(400, 'Niepoprawne lub niekompletne dane przepisu.');
    }

    if ([...sprzet, ...sprzet_alternatywny].some((id) => !isPositiveInt(id))) {
        throw httpError(400, 'Niepoprawne identyfikatory sprzętu.');
    }

    const invalidIngredient = skladniki.some((s) => {
        const qty = Number(s?.qty);
        return !isPositiveInt(s?.skladnik_id)
            || !Number.isFinite(qty)
            || qty <= 0
            || qty > MAX_QTY
            || !UNITS.includes(s?.unit_meas);
    });

    if (invalidIngredient) throw httpError(400, 'Niepoprawne dane składników.');

    if (new Set(skladniki.map((s) => s.skladnik_id)).size !== skladniki.length) {
        throw httpError(400, 'Składnik może wystąpić w przepisie tylko raz.');
    }

    return {
        nazwa: nazwa.trim(),
        czas,
        trudnosc,
        kalorycznosc,
        porcja,
        sprzet: [...new Set(sprzet)],
        sprzet_alternatywny: [...new Set(sprzet_alternatywny)],
        opis,
        diety,
        alergeny,
        skladniki: skladniki.map(({ skladnik_id, qty, unit_meas }) => ({
            skladnik_id,
            qty: Number(qty),
            unit_meas
        }))
    };
};

const assertEquipmentExists = async ({ sprzet, sprzet_alternatywny: alternatywny }) => {
    const ids = [...new Set([...sprzet, ...alternatywny])];

    if (ids.length === 0) return;

    const existing = await equipmentRepository.findExistingIds(ids);

    if (existing.length !== ids.length) throw httpError(400, 'Wybrany sprzęt nie istnieje.');
};

const loadContext = async () => {
    const [stock, equipment] = await Promise.all([
        recipeRepository.getPantryStock(),
        equipmentRepository.getAll()
    ]);

    return { stock, equipment };
};

const describe = async (recipes) => {
    const { stock, equipment } = await loadContext();
    return recipes.map((recipe) => describeRecipe(recipe, stock, equipment));
};

const getAll = async (filters) => describe(await recipeRepository.getAll(filters));

const getMatching = async () => {
    const recipes = await getAll();

    return recipes
        .filter((recipe) => recipe.sprzet_gotowy && recipe.procent_brakow <= MATCH_LIMIT)
        .sort((a, b) => a.procent_brakow - b.procent_brakow || a.nazwa.localeCompare(b.nazwa, 'pl'));
};

const getById = async (id) => {
    const recipe = orNotFound(await recipeRepository.getById(id), NOT_FOUND);
    const [described] = await describe([recipe]);
    return described;
};

const create = async (body) => {
    const data = validate(body);
    await assertEquipmentExists(data);
    return getById((await recipeRepository.create(data)).id);
};

const update = async (id, body) => {
    const data = validate(body);
    await assertEquipmentExists(data);
    orNotFound(await recipeRepository.update(id, data), NOT_FOUND);
    return getById(id);
};

const remove = async (id) => {
    if (!await recipeRepository.remove(id)) throw httpError(404, NOT_FOUND);
};

const setFavorite = async (id, body) => {
    if (typeof body?.ulubione !== 'boolean') {
        throw httpError(400, 'Pole ulubione musi mieć wartość true lub false.');
    }
    if (!await recipeRepository.setFavorite(id, body.ulubione)) throw httpError(404, NOT_FOUND);

    return getById(id);
};

const cook = async (id, body) => {
    const porcje = body?.porcje;

    if (porcje !== undefined && !isPositiveInt(porcje)) {
        throw httpError(400, 'Liczba porcji musi być dodatnią liczbą całkowitą.');
    }

    const plan = await recipeRepository.cook(id, (recipe, stock) =>
        planConsumption(recipe, stock, porcje ?? recipe.porcja));

    orNotFound(plan, NOT_FOUND);

    if (plan.braki.length > 0) {
        throw httpError(409, `Brakuje składników: ${plan.braki.join(', ')}.`, plan.braki);
    }

    return {
        message: 'Składniki zostały odjęte ze spiżarni.',
        zaktualizowane: plan.aktualizacje.length,
        usuniete: plan.usuniete.length
    };
};

module.exports = {
    getAll,
    getMatching,
    getById,
    create,
    update,
    remove,
    setFavorite,
    cook
};
