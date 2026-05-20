const express = require('express');
const router = express.Router();
const controller = require('../controllers');

router.get('/health', controller.healthCheck);
router.get('/test', controller.testRoute);

// Endpoints de Plagio y Detección de IA (Winston AI)
router.post('/detect', controller.detectPlagiarism);
router.post('/detect-ai', controller.detectAIContent);
router.get('/scans/:intentoId', controller.getScanStatus);

module.exports = router;
