const express = require('express');
const router = express.Router();

const equipmentController = require('../controllers/equipmentController');

router.get('/sprzet', equipmentController.getAll);
router.post('/sprzet', equipmentController.create);
router.put('/sprzet/:id', equipmentController.update);
router.patch('/sprzet/:id/status', equipmentController.updateStatus);
router.delete('/sprzet/:id', equipmentController.remove);

module.exports = router;
