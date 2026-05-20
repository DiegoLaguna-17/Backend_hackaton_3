const express = require('express');
const router = express.Router();
const controller = require('../controllers');
const authController = require('../controllers/authController');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Health check
router.get('/health', controller.healthCheck);
router.get('/test', controller.testRoute);

// Login (público)
router.post('/auth/login', authController.login);

// Crear usuario (solo admin)
router.post('/auth/crear-usuario', verificarToken, soloAdmin, authController.crearUsuario);

// Listar todos los usuarios (solo admin)
router.get('/auth/usuarios', verificarToken, soloAdmin, authController.listarUsuarios);

// Listar roles disponibles (solo admin)
router.get('/auth/roles', verificarToken, soloAdmin, authController.listarRoles);

// Ver perfil propio (cualquier usuario autenticado)
router.get('/auth/perfil', verificarToken, authController.perfil);

module.exports = router;