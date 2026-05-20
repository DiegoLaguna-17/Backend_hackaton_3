const express = require('express');
const router = express.Router();
const controller = require('../controllers');

router.get('/health', controller.healthCheck);
router.get('/test', controller.testRoute);
router.get('/lms/tarea/:tarea_id/resultados',controller.obtenerResultadosTareaLMS);
module.exports = router;
