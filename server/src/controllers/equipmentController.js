const equipmentService = require('../services/equipmentService');
const { parseId } = require('../utils/http');

const getAll = async (req, res) => {
    res.status(200).json(await equipmentService.getAll());
};

const create = async (req, res) => {
    res.status(201).json(await equipmentService.create(req.body));
};

const update = async (req, res) => {
    res.status(200).json(await equipmentService.update(parseId(req.params.id), req.body));
};

const updateStatus = async (req, res) => {
    res.status(200).json(await equipmentService.updateStatus(parseId(req.params.id), req.body));
};

const remove = async (req, res) => {
    await equipmentService.remove(parseId(req.params.id));
    res.status(204).end();
};

module.exports = { getAll, create, update, updateStatus, remove };
