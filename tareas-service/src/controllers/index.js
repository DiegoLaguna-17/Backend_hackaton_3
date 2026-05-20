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
        service: "servicio_2",
        supabase: supabaseStatus,
        error: dbError
    });
};

const testRoute = async (req, res) => {
    try {
        res.json({ message: 'Test route from servicio_2' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const crearTarea = async (req, res) => {
  try {
    const {
      profesor_id,
      titulo,
      descripcion,
      fecha_limite,
      casos_prueba, 
    } = req.body;

    if (!profesor_id || !titulo || !fecha_limite) {
      return res.status(400).json({
        ok: false,
        message: "profesor_id, titulo y fecha_limite son obligatorios",
      });
    }

    if (!casos_prueba || !Array.isArray(casos_prueba) || casos_prueba.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "Debes enviar al menos un caso de prueba",
      });
    }

    // 1. Crear tarea
    const { data: tarea, error: errorTarea } = await supabase
      .from("tarea")
      .insert([
        {
          profesor_id,
          titulo,
          descripcion: descripcion || null,
          fecha_limite,
        },
      ])
      .select()
      .single();

    if (errorTarea) {
      return res.status(500).json({
        ok: false,
        message: "Error al crear tarea",
        error: errorTarea.message,
      });
    }

    // 2. Preparar casos de prueba con tarea_id
    const casosInsert = casos_prueba.map((c) => ({
      tarea_id: tarea.id,
      entrada: c.entrada,
      salida_esperada: c.salida_esperada,
      peso_porcentaje: c.peso_porcentaje ?? 100,
    }));

    // 3. Insertar casos de prueba
    const { data: casos, error: errorCasos } = await supabase
      .from("caso_prueba")
      .insert(casosInsert)
      .select();

    if (errorCasos) {
      return res.status(500).json({
        ok: false,
        message: "Tarea creada pero error al insertar casos de prueba",
        error: errorCasos.message,
        tarea,
      });
    }

    return res.status(201).json({
      ok: true,
      message: "Tarea y casos de prueba creados correctamente",
      tarea,
      casos_prueba: casos,
    });
  } catch (error) {
    console.error("Error crearTarea:", error);

    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};

const subirTarea = async (req, res) => {
  try {
    const { tarea_id, estudiante_id, lenguaje_programacion } = req.body;
    const file = req.file;

    if (!tarea_id || !estudiante_id || !lenguaje_programacion) {
      return res.status(400).json({
        ok: false,
        message: "Faltan datos obligatorios",
      });
    }

    if (!file) {
      return res.status(400).json({
        ok: false,
        message: "Debes subir un archivo",
      });
    }

    const { data: tarea, error: errorTarea } = await supabase
      .from("tarea")
      .select("id, habilitada, fecha_limite")
      .eq("id", tarea_id)
      .single();

    if (errorTarea || !tarea) {
      return res.status(404).json({
        ok: false,
        message: "Tarea no encontrada",
      });
    }

    if (!tarea.habilitada) {
      return res.status(403).json({
        ok: false,
        message: "La tarea está deshabilitada y no acepta envíos",
      });
    }

    const ahora = new Date();
    if (new Date(tarea.fecha_limite) < ahora) {
      return res.status(403).json({
        ok: false,
        message: "La fecha límite de la tarea ya expiró",
      });
    }

    const { data: intentos } = await supabase
      .from("intento_envio")
      .select("numero_intento")
      .eq("tarea_id", tarea_id)
      .eq("estudiante_id", estudiante_id)
      .order("numero_intento", { ascending: false })
      .limit(1);

    const nuevoIntento =
      intentos?.length > 0 ? intentos[0].numero_intento + 1 : 1;

    const fileName = `${tarea_id}/${estudiante_id}/intento_${nuevoIntento}_${Date.now()}_${file.originalname}`;

    const { error: uploadError } = await supabase.storage
      .from("archivos_tarea")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) {
      return res.status(500).json({
        ok: false,
        message: "Error subiendo archivo",
        error: uploadError.message,
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from("archivos_tarea")
      .getPublicUrl(fileName);

    const codigo_file_url = publicUrlData.publicUrl;

    const { data, error } = await supabase
      .from("intento_envio")
      .insert([
        {
          tarea_id,
          estudiante_id,
          codigo_file_url,
          lenguaje_programacion,
          numero_intento: nuevoIntento,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        ok: false,
        message: "Error guardando intento",
        error: error.message,
      });
    }

    // Disparar la detección de plagio de forma asíncrona no-bloqueante
    const plagioServiceUrl = process.env.PLAGIO_SERVICE_URL || 'http://plagio-service:3004';
    fetch(`${plagioServiceUrl}/detect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ intentoId: data.id })
    }).then(async (response) => {
        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Plagio Trigger Error] Status ${response.status}: ${errText}`);
        } else {
            console.log(`[Plagio Trigger Success] Detección iniciada para intento ${data.id}`);
        }
    }).catch((err) => {
        console.error('[Plagio Trigger Error] Fallo al conectar con plagio-service:', err.message);
    });

    return res.status(201).json({
      ok: true,
      message: "Tarea subida correctamente",
      intento: data,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};

const obtenerTareas = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tarea")
      .select("*")
      .order("fecha_creacion", { ascending: false });

    if (error) {
      return res.status(500).json({
        ok: false,
        message: "Error al obtener tareas",
        error: error.message,
      });
    }

    return res.json({
      ok: true,
      tareas: data,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};

const obtenerTareasPorDocente = async (req, res) => {
  try {
    const { profesor_id } = req.params;

    if (!profesor_id) {
      return res.status(400).json({
        ok: false,
        message: "profesor_id es obligatorio",
      });
    }

    const { data, error } = await supabase
      .from("tarea")
      .select("*")
      .eq("profesor_id", profesor_id)
      .order("fecha_creacion", { ascending: false });

    if (error) {
      return res.status(500).json({
        ok: false,
        message: "Error al obtener tareas del docente",
        error: error.message,
      });
    }

    return res.json({
      ok: true,
      profesor_id,
      tareas: data,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
};

module.exports = {
    healthCheck,
    testRoute,
    crearTarea,
    subirTarea,
    obtenerTareas,
    obtenerTareasPorDocente
};
