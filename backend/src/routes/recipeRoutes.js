const express = require('express');
const router = express.Router();

const recipeController = require('../controllers/recipeController');

router.post('/przepisy', recipeController.create);

module.exports = router;