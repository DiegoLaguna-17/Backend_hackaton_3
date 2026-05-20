const supabase = require('../config/supabaseClient');

const healthCheck = async (req, res) => {
    let supabaseStatus = 'not initialized';
    let dbError = null;

    if (supabase) {
        try {
            // Test de conexión simple según requerimiento
            const { data, error } = await supabase.from('test').select('*').limit(1);
            if (error) {
                throw error;
            }
            supabaseStatus = 'connected';
        } catch (error) {
            console.error(`Error conectando a Supabase en ${req.url}:`, error.message);
            supabaseStatus = 'error';
            dbError = error.message;
        }
    }

    // El servicio siempre responde status 200 para evitar que el healthcheck o el NGINX fallen
    res.json({
        status: "ok",
        service: "servicio_5",
        supabase: supabaseStatus,
        error: dbError
    });
};

const testRoute = async (req, res) => {
    try {
        res.json({ message: 'Test route from servicio_5' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



const obtenerResultadosTareaLMS = async (req, res) => {
  try {
    const { tarea_id } = req.params;

    // 1. traer tarea
    const { data: tarea, error: errorTarea } = await supabase
      .from("tarea")
      .select("id, titulo, profesor_id")
      .eq("id", tarea_id)
      .single();

    if (errorTarea || !tarea) {
      return res.status(404).json({
        ok: false,
        message: "Tarea no encontrada",
      });
    }

    const { data: intentos, error: errorIntentos } = await supabase
      .from("intento_envio")
      .select("*")
      .eq("tarea_id", tarea_id);

    if (errorIntentos) {
      return res.status(500).json({
        ok: false,
        message: "Error obteniendo intentos",
      });
    }

    const { data: calificaciones } = await supabase
      .from("resultado_calificacion")
      .select("*");

    const { data: plagios } = await supabase
      .from("reporte_plagio")
      .select("*");

    const resultados = intentos.map((i) => {
      const cal = calificaciones?.find(
        (c) => c.intento_id === i.id
      );

      const pl = plagios?.find(
        (p) => p.intento_id === i.id
      );

      return {
        estudiante_id: i.estudiante_id,
        codigo_file_url: i.codigo_file_url,
        lenguaje_programacion: i.lenguaje_programacion,
        numero_intento: i.numero_intento,

       
        nota: cal?.nota_obtenida ?? null,
        compilo_exitosamente: cal?.compilo_exitosamente ?? null,
        logs_ejecucion: cal?.logs_ejecucion ?? null,

        
        plagio: pl
          ? {
              porcentaje_similitud: pl.porcentaje_similitud,
              estado_alerta: pl.estado_alerta,
              detalles_comparacion: pl.detalles_comparacion,
            }
          : null,
      };
    });

    return res.json({
      ok: true,
      tarea: {
        id: tarea.id,
        titulo: tarea.titulo,
        profesor_id: tarea.profesor_id,
      },
      estudiantes: resultados,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error en integración LMS",
    });
  }
};



module.exports = {
    healthCheck,
    testRoute,
    obtenerResultadosTareaLMS
};
