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

module.exports = {
    healthCheck,
    testRoute
};
