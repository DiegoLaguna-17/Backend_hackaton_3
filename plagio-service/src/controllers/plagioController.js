const supabase = require('../config/supabaseClient');
const winstonService = require('../services/winstonService');
const stringSimilarity = require('string-similarity');

/**
 * Auxiliar para descargar el contenido textual de una URL.
 */
async function downloadFileContent(url) {
    if (!url) {
        throw new Error('La URL de código (codigo_file_url) está vacía.');
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error al descargar el archivo desde ${url} (Status: ${response.status})`);
    }
    return await response.text();
}

/**
 * Endpoint para evaluar el plagio local y externo de una entrega.
 * POST /detect
 */
const detectPlagiarism = async (req, res) => {
    const intentoId = req.body.intentoId || req.body.intento_id;

    if (!intentoId) {
        return res.status(400).json({ error: 'El campo "intentoId" es obligatorio en el cuerpo de la petición.' });
    }

    if (!supabase) {
        return res.status(500).json({ error: 'El cliente de Supabase no está inicializado en el servidor.' });
    }

    try {
        console.log(`[Plagio] Iniciando análisis para el intento: ${intentoId}`);

        // 1. Obtener la fila de intento_envio
        const { data: currentIntento, error: intentoError } = await supabase
            .from('intento_envio')
            .select('*')
            .eq('id', intentoId)
            .maybeSingle();

        if (intentoError) {
            console.error('Error al obtener intento_envio:', intentoError);
            return res.status(500).json({ error: 'Error al consultar la entrega en la base de datos.', details: intentoError.message });
        }

        if (!currentIntento) {
            return res.status(404).json({ error: `No se encontró ningún intento de envío con el ID: ${intentoId}` });
        }

        // 2. Descargar código actual
        let currentText = '';
        try {
            currentText = await downloadFileContent(currentIntento.codigo_file_url);
        } catch (err) {
            console.error(`Error al descargar código del intento ${intentoId}:`, err);
            return res.status(500).json({ error: 'No se pudo descargar el archivo de código a evaluar.', details: err.message });
        }

        // 3. Similitud Local (Comparación contra todos los intentos de todas las tareas)
        const { data: otherAttempts, error: othersError } = await supabase
            .from('intento_envio')
            .select('id, estudiante_id, codigo_file_url, tarea_id')
            .neq('id', intentoId);

        if (othersError) {
            console.error('Error al obtener otros intentos:', othersError);
            return res.status(500).json({ error: 'Error al consultar los intentos de comparación.', details: othersError.message });
        }

        let maxLocalSimilarity = 0.00;
        const localComparisons = [];

        if (otherAttempts && otherAttempts.length > 0) {
            console.log(`[Plagio] Comparando con ${otherAttempts.length} entregas locales...`);
            
            const comparisonPromises = otherAttempts.map(async (other) => {
                try {
                    const otherText = await downloadFileContent(other.codigo_file_url);
                    const score = stringSimilarity.compareTwoStrings(currentText, otherText);
                    // Convertir a porcentaje (0 a 100) y redondear a 2 decimales
                    const percentageScore = Math.round(score * 10000) / 100;
                    return {
                        intento_id: other.id,
                        estudiante_id: other.estudiante_id,
                        porcentaje_similitud: percentageScore
                    };
                } catch (err) {
                    console.warn(`[Plagio Warning] No se pudo comparar con intento ${other.id}: ${err.message}`);
                    return null;
                }
            });

            const results = await Promise.all(comparisonPromises);
            for (const r of results) {
                if (r !== null) {
                    localComparisons.push(r);
                    if (r.porcentaje_similitud > maxLocalSimilarity) {
                        maxLocalSimilarity = r.porcentaje_similitud;
                    }
                }
            }
        }

        // 4. Detección Externa con Winston AI (si la API key está configurada)
        let externalSimilarity = 0.00;
        let winstonDetails = null;

        try {
            const hasApiKey = !!process.env.WINSTON_API_KEY;
            if (hasApiKey) {
                console.log('[Plagio] Iniciando análisis externo con Winston AI...');
                const winstonResponse = await winstonService.checkPlagiarism(currentText);
                externalSimilarity = typeof winstonResponse.score === 'number' ? winstonResponse.score : 0.00;
                winstonDetails = winstonResponse;
            } else {
                console.warn('[Plagio Warning] WINSTON_API_KEY no está configurada. Se omite análisis externo.');
                winstonDetails = { warning: 'Winston AI API key no configurada. Análisis externo omitido.' };
            }
        } catch (err) {
            console.error('[Plagio Error] Falló el análisis con Winston AI:', err.message);
            winstonDetails = { error: err.message };
        }

        // 5. Determinar estado de alerta (Umbral de sospecha >= 70%)
        const threshold = 70.00;
        const estadoAlerta = (maxLocalSimilarity >= threshold || externalSimilarity >= threshold) ? 'ALERTA' : 'NORMAL';

        // 6. Preparar payload y guardar en la tabla reporte_plagio
        const detallesComparacion = {
            local_comparisons: localComparisons,
            winston_ai: winstonDetails
        };

        const dbPayload = {
            intento_id: intentoId,
            porcentaje_similitud_local: maxLocalSimilarity,
            porcentaje_similitud_externo: externalSimilarity,
            estado_alerta: estadoAlerta,
            detalles_comparacion: detallesComparacion
        };

        console.log(`[Plagio] Guardando reporte en la base de datos para el intento ${intentoId}. Similitud local: ${maxLocalSimilarity}%, Externa: ${externalSimilarity}%`);

        // Consultar si ya existe el reporte
        const { data: existingReport, error: checkError } = await supabase
            .from('reporte_plagio')
            .select('id')
            .eq('intento_id', intentoId)
            .maybeSingle();

        if (checkError) {
            console.error('Error al comprobar reporte de plagio existente:', checkError);
            return res.status(500).json({ error: 'Error al validar registros existentes.', details: checkError.message });
        }

        let finalReport = null;
        if (existingReport) {
            const { data: updatedReport, error: updateError } = await supabase
                .from('reporte_plagio')
                .update(dbPayload)
                .eq('intento_id', intentoId)
                .select()
                .single();

            if (updateError) {
                console.error('Error al actualizar reporte de plagio:', updateError);
                return res.status(500).json({ error: 'Error al actualizar el reporte de plagio en la base de datos.', details: updateError.message });
            }
            finalReport = updatedReport;
        } else {
            const { data: insertedReport, error: insertError } = await supabase
                .from('reporte_plagio')
                .insert(dbPayload)
                .select()
                .single();

            if (insertError) {
                console.error('Error al registrar reporte de plagio:', insertError);
                return res.status(500).json({ error: 'Error al crear el reporte de plagio en la base de datos.', details: insertError.message });
            }
            finalReport = insertedReport;
        }

        return res.status(200).json({
            message: 'Evaluación de plagio completada exitosamente.',
            report: finalReport
        });

    } catch (error) {
        console.error('Error crítico en el controlador de detección de plagio:', error);
        return res.status(500).json({
            error: 'Ocurrió un error inesperado al procesar la solicitud de plagio.',
            details: error.message
        });
    }
};

/**
 * Endpoint para obtener el reporte de plagio de un intento de envío.
 * GET /scans/:intentoId
 */
const getScanStatus = async (req, res) => {
    const { intentoId } = req.params;

    if (!supabase) {
        return res.status(500).json({ error: 'El cliente de Supabase no está inicializado en el servidor.' });
    }

    try {
        console.log(`[Plagio] Buscando reporte para intento: ${intentoId}`);
        const { data: report, error } = await supabase
            .from('reporte_plagio')
            .select('*')
            .eq('intento_id', intentoId)
            .maybeSingle();

        if (error) {
            console.error(`Error al buscar reporte para intento ${intentoId}:`, error);
            return res.status(500).json({ error: 'Error al consultar el reporte en la base de datos.', details: error.message });
        }

        if (!report) {
            return res.status(404).json({ error: `No se encontró ningún reporte de plagio para el intento con ID: ${intentoId}` });
        }

        return res.json(report);
    } catch (error) {
        console.error(`Error inesperado al recuperar reporte de plagio para intento ${intentoId}:`, error);
        return res.status(500).json({ error: 'Error interno del servidor.', details: error.message });
    }
};

/**
 * Endpoint complementario para detectar texto escrito por IA de forma directa.
 * POST /detect-ai
 */
const detectAIContent = async (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'El campo "text" es obligatorio y debe ser una cadena.' });
    }

    if (text.length < 300) {
        return res.status(400).json({ error: 'El texto debe tener al menos 300 caracteres para la detección de IA.' });
    }

    try {
        const results = await winstonService.detectAIContent(text);
        return res.status(200).json({
            message: 'Detección de contenido IA completada con éxito.',
            results
        });
    } catch (error) {
        console.error('Error al realizar detección de IA directa:', error);
        return res.status(500).json({
            error: 'Ocurrió un error al procesar la detección de IA en Winston AI.',
            details: error.message
        });
    }
};

module.exports = {
    detectPlagiarism,
    detectAIContent,
    getScanStatus
};
