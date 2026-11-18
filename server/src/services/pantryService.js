const pantryRepository = require('../repositories/pantryRepository');
const { UNITS, MIN_QTY, MAX_QTY, MAX_INT } = require('../constants');
const { httpError, orNotFound } = require('../utils/http');

const NOT_FOUND = 'Nie znaleziono produktu w spiżarni.';

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const validate = (body) => {
    const { nazwa, qty, unit_meas, expire_date = null, kalorie = null, opis } = body || {};
    const errors = [];

    if (typeof nazwa !== 'string' || !nazwa.trim() || nazwa.trim().length > 100) {
        errors.push('Nazwa jest wymagana (do 100 znaków).');
    }
    if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < MIN_QTY || qty > MAX_QTY) {
        errors.push('Ilość musi wynosić co najmniej 0,01.');
    }
    if (!UNITS.includes(unit_meas)) errors.push('Niepoprawna jednostka.');
    if (expire_date !== null && !isValidDate(expire_date)) {
        errors.push('Data ważności musi mieć format RRRR-MM-DD.');
    }
    if (kalorie !== null && (!Number.isInteger(kalorie) || kalorie < 0 || kalorie > MAX_INT)) {
        errors.push('Kalorie muszą być liczbą całkowitą nie mniejszą od zera.');
    }
    if (opis !== undefined && opis !== null && (typeof opis !== 'string' || opis.length > 1000)) {
        errors.push('Opis może mieć najwyżej 1000 znaków.');
    }

    if (errors.length > 0) throw httpError(400, errors[0], errors);

    return { nazwa: nazwa.trim(), qty, unit_meas, expire_date, kalorie, opis };
};

const getAll = () => pantryRepository.getAll();

const create = (body) => pantryRepository.create(validate(body));

const update = async (id, body) =>
    orNotFound(await pantryRepository.update(id, validate(body)), NOT_FOUND);

const remove = async (id) => {
    if (!await pantryRepository.remove(id)) throw httpError(404, NOT_FOUND);
};

module.exports = { getAll, create, update, remove };
