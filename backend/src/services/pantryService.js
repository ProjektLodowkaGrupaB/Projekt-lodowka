const pantryRepository = require('../repositories/pantryRepository');
const { UNITS, MAX_QTY } = require('../constants');
const { httpError, orNotFound } = require('../utils/http');

const NOT_FOUND = 'Nie znaleziono produktu w spiżarni.';

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const validate = (body) => {
    const { nazwa, ilosc, jednostka, data_waznosci = null, kalorie = null, opis } = body || {};
    const errors = [];

    if (typeof nazwa !== 'string' || !nazwa.trim() || nazwa.trim().length > 100) {
        errors.push('Nazwa jest wymagana (do 100 znaków).');
    }
    if (typeof ilosc !== 'number' || !Number.isFinite(ilosc) || ilosc <= 0 || ilosc > MAX_QTY) {
        errors.push('Ilość musi być liczbą większą od zera.');
    }
    if (!UNITS.includes(jednostka)) errors.push('Niepoprawna jednostka.');
    if (data_waznosci !== null && !isValidDate(data_waznosci)) {
        errors.push('Data ważności musi mieć format RRRR-MM-DD.');
    }
    if (kalorie !== null && (!Number.isInteger(kalorie) || kalorie < 0)) {
        errors.push('Kalorie muszą być liczbą całkowitą nie mniejszą od zera.');
    }
    if (opis !== undefined && opis !== null && (typeof opis !== 'string' || opis.length > 1000)) {
        errors.push('Opis może mieć najwyżej 1000 znaków.');
    }

    if (errors.length > 0) throw httpError(400, errors[0], errors);

    return { nazwa: nazwa.trim(), ilosc, jednostka, data_waznosci, kalorie, opis };
};

const getAll = () => pantryRepository.getAll();

const create = (body) => pantryRepository.create(validate(body));

const update = async (id, body) =>
    orNotFound(await pantryRepository.update(id, validate(body)), NOT_FOUND);

const remove = async (id) => {
    if (!await pantryRepository.remove(id)) throw httpError(404, NOT_FOUND);
};

module.exports = { getAll, create, update, remove };
