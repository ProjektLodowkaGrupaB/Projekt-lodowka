const pantryService = require('../services/pantryService');

const getAll = async (req, res, next) => {
    try {
        const products = await pantryService.getAll();

        res.status(200).json(products);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAll
};