const express = require('express');
const router = express.Router();

const ingredientController = require('../controllers/ingredientController');

router.get('/skladniki', ingredientController.getAll);

module.exports = router;
