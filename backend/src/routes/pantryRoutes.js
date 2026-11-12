const express = require('express');
const router = express.Router();

const pantryController = require('../controllers/pantryController');

router.get('/spizarnia', pantryController.getAll);

module.exports = router;