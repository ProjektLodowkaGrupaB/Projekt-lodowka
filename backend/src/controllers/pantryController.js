const pantryService = require('../services/pantryService');
const { parseId } = require('../utils/http');

// Express 5 sam przekazuje błędy z funkcji async do errorHandler.
const getAll = async (req, res) => {
    res.status(200).json(await pantryService.getAll());
};

const create = async (req, res) => {
    res.status(201).json(await pantryService.create(req.body));
};

const update = async (req, res) => {
    res.status(200).json(await pantryService.update(parseId(req.params.id), req.body));
};

const remove = async (req, res) => {
    await pantryService.remove(parseId(req.params.id));
    res.status(204).end();
};

module.exports = { getAll, create, update, remove };
