const recipeService = require('../services/recipeService');
const { parseId } = require('../utils/http');

const getAll = async (req, res) => {
    res.status(200).json(await recipeService.getAll({ tylkoUlubione: req.query.ulubione === 'true' }));
};

const getMatching = async (req, res) => {
    res.status(200).json(await recipeService.getMatching());
};

const getById = async (req, res) => {
    res.status(200).json(await recipeService.getById(parseId(req.params.id)));
};

const create = async (req, res) => {
    const recipe = await recipeService.create(req.body);

    res.status(201).json({
        message: 'Przepis został dodany pomyślnie.',
        przepis_id: recipe.id,
        przepis: recipe
    });
};

const update = async (req, res) => {
    res.status(200).json(await recipeService.update(parseId(req.params.id), req.body));
};

const remove = async (req, res) => {
    await recipeService.remove(parseId(req.params.id));
    res.status(204).end();
};

const setFavorite = async (req, res) => {
    res.status(200).json(await recipeService.setFavorite(parseId(req.params.id), req.body));
};

const cook = async (req, res) => {
    res.status(200).json(await recipeService.cook(parseId(req.params.id), req.body));
};

module.exports = { getAll, getMatching, getById, create, update, remove, setFavorite, cook };

/** */