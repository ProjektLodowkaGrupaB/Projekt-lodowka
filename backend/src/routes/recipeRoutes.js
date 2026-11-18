const express = require('express');
const router = express.Router();

const recipeController = require('../controllers/recipeController');

router.get('/przepisy', recipeController.getAll);
router.get('/przepisy/dopasowane', recipeController.getMatching);
router.get('/przepisy/:id', recipeController.getById);
router.post('/przepisy', recipeController.create);
router.put('/przepisy/:id', recipeController.update);
router.delete('/przepisy/:id', recipeController.remove);
router.patch('/przepisy/:id/ulubione', recipeController.setFavorite);
router.post('/przepisy/:id/ugotuj', recipeController.cook);

module.exports = router;
