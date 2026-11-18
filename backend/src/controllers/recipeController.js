const recipeService = require('../services/recipeService');

const create = async (req, res, next) => {
    try {
        const recipe = await recipeService.create(req.body);

        res.status(201).json({
            message: 'Przepis został dodany pomyślnie.',
            przepis_id: recipe.id
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    create
};