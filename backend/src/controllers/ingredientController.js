const ingredientRepository = require('../repositories/ingredientRepository');

const getAll = async (req, res) => {
    res.status(200).json(await ingredientRepository.getAll());
};

module.exports = { getAll };
