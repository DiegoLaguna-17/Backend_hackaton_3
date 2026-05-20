const express = require('express');

const router = express.Router();
const controller = require('../controllers');
const {upload}=require("../middlewares/multer");

router.get('/health', controller.healthCheck);
router.get('/test', controller.testRoute);
router.get('/tareas/estudiante',controller.obtenerTareas);
router.get("/tarea/profesor/:profesor_id", controller.obtenerTareasPorDocente);

router.post('/crearTarea',controller.crearTarea);
router.post(
  "/tarea/subir",
  upload.single("file"),
  controller.subirTarea
);

module.exports = router;
