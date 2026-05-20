const express = require('express');
const router = express.Router();
const controller = require('../controllers');

router.get('/health', controller.healthCheck);
router.post('/ejecutar', controller.ejecutarYCalificar);
router.get('/resultado/:intento_id', controller.obtenerResultado);
//para la pruebaa
router.post('/ejecutar-directo', controller.ejecutarDirecto);
//hasta aqui lo de la prueba
module.exports = router;