const express = require('express');
const router = express.Router();

const pantryController = require('../controllers/pantryController');

router.get('/spizarnia', pantryController.getAll);
router.post('/spizarnia', pantryController.create);
router.put('/spizarnia/:id', pantryController.update);
router.delete('/spizarnia/:id', pantryController.remove);

module.exports = router;
