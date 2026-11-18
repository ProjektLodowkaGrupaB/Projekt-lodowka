const equipmentRepository = require('../repositories/equipmentRepository');
const { EQUIPMENT_STATUSES } = require('../constants');
const { httpError, orNotFound } = require('../utils/http');

const NOT_FOUND = 'Nie znaleziono sprzętu.';

// sprawny decyduje o dopasowaniu przepisów, więc status_opis nie może mu przeczyć.
const present = (row) => ({
    ...row,
    status_opis: row.sprawny
        ? 'gotowy'
        : (row.status_opis && row.status_opis !== 'gotowy' ? row.status_opis : 'niedostępny')
});

const parseStatus = (statusOpis) => {
    if (!EQUIPMENT_STATUSES.includes(statusOpis)) {
        throw httpError(400, 'Niepoprawny status sprzętu.');
    }

    return { sprawny: statusOpis === 'gotowy', status_opis: statusOpis };
};

const validate = (body) => {
    const { nazwa, kategoria = 'AGD małe', notatki = '', status_opis: statusOpis = 'gotowy' } = body || {};

    if (typeof nazwa !== 'string' || !nazwa.trim() || nazwa.trim().length > 1000) {
        throw httpError(400, 'Nazwa sprzętu jest wymagana.');
    }
    if (typeof kategoria !== 'string' || !kategoria.trim() || kategoria.length > 255) {
        throw httpError(400, 'Niepoprawna kategoria.');
    }
    if (typeof notatki !== 'string') throw httpError(400, 'Niepoprawne notatki.');

    return {
        nazwa: nazwa.trim(),
        kategoria: kategoria.trim(),
        notatki,
        ...parseStatus(statusOpis)
    };
};

const getAll = async () => (await equipmentRepository.getAll()).map(present);

const create = async (body) => present(await equipmentRepository.create(validate(body)));

const update = async (id, body) =>
    present(orNotFound(await equipmentRepository.update(id, validate(body)), NOT_FOUND));

const updateStatus = async (id, body) => {
    const { sprawny, status_opis: statusOpis } = parseStatus(body?.status_opis);
    return present(orNotFound(await equipmentRepository.updateStatus(id, sprawny, statusOpis), NOT_FOUND));
};

const remove = async (id) => {
    if (!await equipmentRepository.remove(id)) throw httpError(404, NOT_FOUND);
};

module.exports = { getAll, create, update, updateStatus, remove };
