const recipeRepository = require('../repositories/recipeRepository');

const allowedDifficulties = ['łatwy', 'średni', 'trudny'];
const allowedUnits = ['kg', 'g', 'l', 'szt', 'opak.'];

const create = async (data) => {
    const {
        nazwa,
        czas,
        trudnosc,
        kalorycznosc,
        porcja,
        sprzet = [],
        sprzet_alternatywny = [],
        opis = null,
        skladniki
    } = data;

    if (
        typeof nazwa !== 'string' ||
        !nazwa.trim() ||
        nazwa.length > 100 ||
        !Number.isInteger(czas) ||
        czas <= 0 ||
        !allowedDifficulties.includes(trudnosc) ||
        !Number.isInteger(kalorycznosc) ||
        kalorycznosc < 0 ||
        !Number.isInteger(porcja) ||
        porcja <= 0 ||
        !Array.isArray(sprzet) ||
        !Array.isArray(sprzet_alternatywny) ||
        !Array.isArray(skladniki) ||
        skladniki.length === 0
    ) {
        throw Object.assign(
            new Error('Niepoprawne lub niekompletne dane przepisu.'),
            { status: 400 }
        );
    }

    const invalidEquipment = [...sprzet, ...sprzet_alternatywny]
        .some(id => !Number.isInteger(id) || id <= 0);

    if (invalidEquipment) {
        throw Object.assign(
            new Error('Niepoprawne identyfikatory sprzętu.'),
            { status: 400 }
        );
    }

    const invalidIngredient = skladniki.some(s =>
        !Number.isInteger(s.skladnik_id) ||
        s.skladnik_id <= 0 ||
        !Number.isFinite(Number(s.qty)) ||
        Number(s.qty) <= 0 ||
        !allowedUnits.includes(s.unit_meas)
    );

    if (invalidIngredient) {
        throw Object.assign(
            new Error('Niepoprawne dane składników.'),
            { status: 400 }
        );
    }

    return await recipeRepository.create({
        nazwa: nazwa.trim(),
        czas,
        trudnosc,
        kalorycznosc,
        porcja,
        sprzet,
        sprzet_alternatywny,
        opis,
        skladniki
    });
};

module.exports = {
    create
};