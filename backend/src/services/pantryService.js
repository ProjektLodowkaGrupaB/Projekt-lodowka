const pantryRepository = require('../repositories/pantryRepository');

const getAll = async () => {
    return await pantryRepository.getAll();
};

module.exports = {
    getAll
};