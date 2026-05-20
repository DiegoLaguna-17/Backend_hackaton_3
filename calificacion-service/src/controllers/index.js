const supabase = require('../config/supabaseClient');
const { calificar } = require('../services/graderService');

const healthCheck = async (req, res) => {
  let supabaseStatus = 'not initialized';
  let dbError = null;

  if (supabase) {
    try {
      const { error } = await supabase.from('resultado_calificacion').select('id').limit(1);
      if (error) throw error;
      supabaseStatus = 'connected';
    } catch (error) {
      supabaseStatus = 'error';
      dbError = error.message;
    }
  }

  res.json({
    status: 'ok',
    service: 'calificacion-service',
    supabase: supabaseStatus,
    error: dbError
  });
};

const ejecutarYCalificar = async (req, res) => {
  try {
    const { intento_id } = req.body;

    if (!intento_id) {
      return res.status(400).json({ error: 'intento_id es requerido' });
    }

    // 1. Buscar el intento (código del estudiante)
    const { data: intento, error: errorIntento } = await supabase
      .from('intento_envio')
      .select('*')
      .eq('id', intento_id)
      .single();

    if (errorIntento || !intento) {
      return res.status(404).json({ error: 'Intento no encontrado' });
    }

    // 2. Buscar los casos de prueba de esa tarea
    const { data: casosPrueba, error: errorCasos } = await supabase
      .from('caso_prueba')
      .select('*')
      .eq('tarea_id', intento.tarea_id);

    if (errorCasos || !casosPrueba || casosPrueba.length === 0) {
      return res.status(404).json({ error: 'No hay casos de prueba para esta tarea' });
    }

    // 3. Calificar (ejecutar código contra cada caso)
    const resultadoCalificacion = await calificar(
      intento.codigo_file_url,       // el código del estudiante
      intento.lenguaje_programacion, // python, java, cpp, javascript
      casosPrueba
    );

    // 4. Guardar resultado en Supabase
    const { data: resultadoGuardado, error: errorGuardar } = await supabase
      .from('resultado_calificacion')
      .insert({
        intento_id,
        nota_obtenida: resultadoCalificacion.nota_final,
        compilo_exitosamente: resultadoCalificacion.compilo_exitosamente,
        logs_ejecucion: JSON.stringify(resultadoCalificacion.casos)
      })
      .select()
      .single();

    if (errorGuardar) {
      return res.status(500).json({ error: 'Error guardando resultado', detalle: errorGuardar.message });
    }

    // 5. Responder
    return res.status(200).json({
      mensaje: 'Calificación completada',
      nota_final: resultadoCalificacion.nota_final,
      compilo_exitosamente: resultadoCalificacion.compilo_exitosamente,
      detalle_casos: resultadoCalificacion.casos,
      resultado_id: resultadoGuardado.id
    });

  } catch (err) {
    console.error('Error en ejecutarYCalificar:', err);
    return res.status(500).json({ error: 'Error interno del servidor', detalle: err.message });
  }
};

const obtenerResultado = async (req, res) => {
  try {
    const { intento_id } = req.params;

    const { data, error } = await supabase
      .from('resultado_calificacion')
      .select('*')
      .eq('intento_id', intento_id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Resultado no encontrado' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
//para hacer la prueba
const ejecutarDirecto = async (req, res) => {
  try {
    const { codigo, lenguaje, casos_prueba } = req.body;

    if (!codigo || !lenguaje || !casos_prueba) {
      return res.status(400).json({ error: 'codigo, lenguaje y casos_prueba son requeridos' });
    }

    const resultadoCalificacion = calificar(codigo, lenguaje, casos_prueba);

    return res.status(200).json({
      mensaje: 'Calificación completada (modo directo)',
      nota_final: resultadoCalificacion.nota_final,
      compilo_exitosamente: resultadoCalificacion.compilo_exitosamente,
      detalle_casos: resultadoCalificacion.casos
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
//hasta aqui lo de la prueba
module.exports = {
  healthCheck,
  ejecutarYCalificar,
  obtenerResultado,
  ejecutarDirecto  // ← agregar esto para la prueba
};